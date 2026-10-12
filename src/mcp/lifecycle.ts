import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Workspace } from "../workspace/manager.js";
import { assertSharedIdle, runTunnelClient, sharedPaths, tunnelInitArgs, withSharedLock } from "./commands.js";

/** Serialize switch/start/stop across separate CLI invocations. Runtime PID lock is separate. */
export async function withLifecycleLock<T>(action: () => Promise<T>): Promise<T> {
  const { directory } = sharedPaths();
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const lock = path.join(directory, "c2c-shared.operation.lock");
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      fs.writeFileSync(lock, String(process.pid), { flag: "wx", mode: 0o600 });
      try { return await action(); } finally {
        if (fs.existsSync(lock) && fs.readFileSync(lock, "utf8") === String(process.pid)) fs.rmSync(lock, { force: true });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const owner = Number(fs.readFileSync(lock, "utf8"));
      if (!Number.isSafeInteger(owner) || owner < 1) throw new Error("Invalid lifecycle lock; inspect before retrying.");
      try { process.kill(owner, 0); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
        // Recheck its contents before removing a stale lock.
        if (fs.readFileSync(lock, "utf8") === String(owner)) fs.rmSync(lock, { force: true });
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Shared tunnel lifecycle operation is busy; retry shortly.");
}

export function configuredTunnelId(): string | null {
  const { config } = sharedPaths();
  if (!fs.existsSync(config)) return null;
  const data = JSON.parse(fs.readFileSync(config, "utf8")) as { tunnelId?: unknown };
  if (typeof data.tunnelId !== "string" || !/^tunnel_[A-Za-z0-9_-]+$/.test(data.tunnelId)) throw new Error("Invalid saved Tunnel ID");
  return data.tunnelId;
}

export function sharedStatus(): { running: boolean; pid: number | null; workspaceId: string | null; workspaceRoot: string | null } {
  const { lock, active } = sharedPaths();
  let running = false;
  let pid: number | null = null;
  if (fs.existsSync(lock)) {
    const value = Number(fs.readFileSync(lock, "utf8"));
    if (Number.isSafeInteger(value) && value > 0) {
      try { process.kill(value, 0); running = true; pid = value; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
    }
  }
  const selected = fs.existsSync(active) ? fs.readFileSync(active, "utf8").trim().split("\n") : [];
  return { running, pid, workspaceId: selected[0] ?? null, workspaceRoot: selected[1] ?? null };
}

// Refuse to reuse a Tunnel ID already held by a legacy workspace profile.
// Do not kill or reconfigure a process we did not start.
export function assertNoLegacyConflict(tunnelId: string): void {
  if (process.platform === "win32") throw new Error("Automatic shared tunnel requires process inspection, not available on Windows yet.");
  const processes = execFileSync("ps", ["-axo", "pid=,command="], { encoding: "utf8" });
  for (const line of processes.split("\n")) {
    if (!/tunnel-client\s+run\b/.test(line)) continue;
    const match = line.match(/--profile\s+(c2c-[A-Za-z0-9_-]+)/);
    const dir = line.match(/--profile-dir\s+(.+?)(?:\s+--[A-Za-z-]+|$)/);
    if (!match || !dir) continue;
    const file = path.join(dir[1].trim(), match[1] + ".yaml");
    if (!fs.existsSync(file)) continue;
    const contents = fs.readFileSync(file, "utf8");
    if (contents.includes(`tunnel_id: "${tunnelId}"`) || contents.includes(`tunnel_id: ${tunnelId}\n`)) {
      throw new Error(`Tunnel ID is already in use by running profile ${match[1]} (${dir[1].trim()}). Stop it explicitly before starting the shared tunnel.`);
    }
  }
}

export async function selectSharedWorkspace(workspace: Workspace, tunnelId: string): Promise<void> {
  await withSharedLock(async () => {
    // Verify under the runtime lock, not before it, to narrow TOCTOU races.
    assertNoLegacyConflict(tunnelId);
    const { directory, active } = sharedPaths();
    const profile = path.join(directory, "c2c-shared.yaml");
    const oldProfile = fs.existsSync(profile) ? fs.readFileSync(profile) : null;
    const oldActive = fs.existsSync(active) ? fs.readFileSync(active) : null;
    try {
      const result = await runTunnelClient([...tunnelInitArgs(workspace, tunnelId, true), "--force"]);
      if (result !== 0) throw new Error(`Shared profile update failed (exit ${result}).`);
      fs.writeFileSync(active, `${workspace.id}\n${workspace.root}\n`, { mode: 0o600 });
    } catch (error) {
      if (oldProfile) fs.writeFileSync(profile, oldProfile); else fs.rmSync(profile, { force: true });
      if (oldActive) fs.writeFileSync(active, oldActive); else fs.rmSync(active, { force: true });
      throw error;
    }
  });
}

/** Probe the tunnel-client readiness endpoint written by its ephemeral health listener. */
export async function sharedReadiness(timeoutMs = 1000): Promise<{ ready: boolean; detail: string }> {
  const file = path.join(sharedPaths().directory, "c2c-shared-health.url");
  if (!fs.existsSync(file)) return { ready: false, detail: "Tunnel health endpoint has not been published" };
  const base = fs.readFileSync(file, "utf8").trim();
  let url: URL;
  try { url = new URL(base); } catch { return { ready: false, detail: "Invalid tunnel health endpoint" }; }
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    return { ready: false, detail: "Tunnel health endpoint is not loopback HTTP" };
  }
  try {
    const response = await fetch(new URL("/readyz", url), { signal: AbortSignal.timeout(timeoutMs) });
    return { ready: response.ok, detail: `HTTP ${response.status}` };
  } catch (error) {
    return { ready: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

export async function startSharedWorkspace(root: string): Promise<{ workspaceId: string; running: boolean }> {
  return withLifecycleLock(() => startSharedWorkspaceLocked(root));
}

async function startSharedWorkspaceLocked(root: string): Promise<{ workspaceId: string; running: boolean }> {
  const tunnelId = configuredTunnelId();
  if (!tunnelId) throw new Error("No shared Tunnel ID configured.");
  const workspace = new Workspace(root);
  const state = sharedStatus();
  if (state.running) {
    if (state.workspaceId === workspace.id) {
      const readiness = await sharedReadiness();
      if (!readiness.ready) throw new Error(`Shared tunnel process exists but is not ready: ${readiness.detail}`);
      return { workspaceId: workspace.id, running: true };
    }
    throw new Error(`Shared tunnel is active for ${state.workspaceRoot}; run c2c stop there before switching.`);
  }
  await selectSharedWorkspace(workspace, tunnelId);
  assertSharedIdle();
  const { directory, lock } = sharedPaths();
  const entry = fileURLToPath(new URL("../../bin/c2c.js", import.meta.url));
  fs.rmSync(path.join(directory, "c2c-shared-health.url"), { force: true });
  const log = fs.openSync(path.join(directory, "c2c-shared.log"), "a", 0o600);
  try {
    const child = spawn(process.execPath, [entry, "mcp", "run", "--shared", "--workspace", workspace.root], {
      detached: true, stdio: ["ignore", log, log],
    });
    child.unref();
    // The child acquires the lock before running tunnel-client. Wait for that handshake.
    for (let n = 0; n < 40; n++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (fs.existsSync(lock) && sharedStatus().running) {
        const readiness = await sharedReadiness(250);
        if (readiness.ready) return { workspaceId: workspace.id, running: true };
      }
      try { process.kill(child.pid!, 0); } catch { break; }
    }
    // A child may have acquired its lock but failed before opening the health endpoint.
    // Clean up only the child we launched; never stop another workspace's runtime.
    if (sharedStatus().pid === child.pid) child.kill("SIGTERM");
    throw new Error("Shared tunnel did not become ready; inspect c2c-shared.log.");
  } finally { fs.closeSync(log); }
}

export async function stopSharedWorkspace(root: string): Promise<boolean> {
  return withLifecycleLock(() => stopSharedWorkspaceLocked(root));
}

async function stopSharedWorkspaceLocked(root: string): Promise<boolean> {
  const state = sharedStatus();
  if (!state.running) return false;
  const workspace = new Workspace(root);
  if (state.workspaceId !== workspace.id) throw new Error(`Shared tunnel belongs to ${state.workspaceRoot}; refusing to stop another workspace.`);
  process.kill(state.pid!, "SIGTERM");
  for (let n = 0; n < 40; n++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (!sharedStatus().running) return true;
  }
  throw new Error("Shared tunnel has not stopped; inspect the running process before retrying.");
}
