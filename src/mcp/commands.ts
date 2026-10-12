import { Command } from "commander";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { getStateDir } from "../config/paths.js";
import { Workspace } from "../workspace/manager.js";
import { serveStdio } from "./stdio.js";
import { selectSharedWorkspace, assertNoLegacyConflict, configuredTunnelId, withLifecycleLock } from "./lifecycle.js";

export function tunnelProfile(workspace: Workspace, shared = false): { profile: string; directory: string } {
  return {
    profile: shared ? "c2c-shared" : `c2c-${workspace.id}`,
    directory: path.join(getStateDir(), "mcp-tunnels"),
  };
}

export function quoteCommandArgument(value: string): string {
  if (/[\r\n\0]/.test(value)) throw new Error("Command arguments cannot contain line breaks or NUL.");
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export function tunnelInitArgs(workspace: Workspace, tunnelId: string, shared = false): string[] {
  if (!/^tunnel_[A-Za-z0-9_-]+$/.test(tunnelId)) throw new Error("Invalid Tunnel ID.");
  const { profile, directory } = tunnelProfile(workspace, shared);
  const entry = fileURLToPath(new URL("../../bin/c2c.js", import.meta.url));
  const command = [process.execPath, entry, "mcp", "serve", "--workspace", workspace.root]
    .map(quoteCommandArgument).join(" ");
  return [
    "init", "--sample", "sample_mcp_stdio_local", "--profile", profile,
    "--profile-dir", directory, "--tunnel-id", tunnelId, "--mcp-command", command,
    "--health-listen-addr", "127.0.0.1:0",
  ];
}

export function sharedPaths(): { directory: string; lock: string; active: string; config: string } {
  const directory = path.join(getStateDir(), "mcp-tunnels");
  return { directory, lock: path.join(directory, "c2c-shared.lock"), active: path.join(directory, "c2c-shared.workspace"), config: path.join(directory, "c2c-shared.json") };
}

export function assertSharedIdle(): void {
  const { lock } = sharedPaths();
  if (!fs.existsSync(lock)) return;
  const pid = Number(fs.readFileSync(lock, "utf8"));
  if (Number.isInteger(pid) && pid > 0) {
    try { process.kill(pid, 0); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") { fs.unlinkSync(lock); return; }
      throw error;
    }
    throw new Error(`Shared tunnel is running (PID ${pid}). Stop it before switching workspaces.`);
  }
  throw new Error("Shared tunnel lock is invalid; inspect it before switching.");
}

export async function withSharedLock(action: () => Promise<void>): Promise<void> {
  const { directory, lock } = sharedPaths();
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  assertSharedIdle();
  try { fs.writeFileSync(lock, String(process.pid), { flag: "wx", mode: 0o600 }); }
  catch { throw new Error("Shared tunnel is already starting or running."); }
  try { await action(); } finally { fs.rmSync(lock, { force: true }); }
}

export async function runTunnelClient(args: string[]): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const child = spawn("tunnel-client", args, { stdio: "inherit", shell: false });
    const interrupt = (): void => { child.kill("SIGINT"); };
    const terminate = (): void => { child.kill("SIGTERM"); };
    const cleanup = (): void => {
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", terminate);
    };
    process.once("SIGINT", interrupt);
    process.once("SIGTERM", terminate);
    child.once("error", (error) => {
      cleanup();
      reject(new Error(`Cannot launch tunnel-client: ${error.message}`));
    });
    child.once("close", (code, signal) => {
      cleanup();
      resolve(code ?? (signal === "SIGINT" ? 130 : 143));
    });
  });
}

export function registerMcpCommands(program: Command): void {
  const mcp = program.command("mcp").description("Private MCP over stdio and OpenAI Secure MCP Tunnel");
  mcp.command("serve")
    .description("Serve read-only workspace tools over stdio")
    .requiredOption("-w, --workspace <path>")
    .action(async (opts: { workspace: string }) => {
      try {
        await serveStdio(path.resolve(opts.workspace));
      } catch (error) {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
    });
  mcp.command("configure")
    .description("Create a persistent workspace tunnel-client profile (does not overwrite existing profiles)")
    .requiredOption("--tunnel-id <id>")
    .option("-w, --workspace <path>")
    .action(async (opts: { workspace?: string; tunnelId: string }) => {
      const workspace = new Workspace(path.resolve(opts.workspace ?? process.cwd()));
      const code = await runTunnelClient(tunnelInitArgs(workspace, opts.tunnelId));
      process.exitCode = code;
      if (code === 0) {
        const root = quoteCommandArgument(workspace.root);
        process.stdout.write(`\nUse the C2C commands to select the saved profile directory:\n  c2c mcp doctor --workspace ${root}\n  c2c mcp run --workspace ${root}\n`);
      }
    });
  mcp.command("set-tunnel")
    .description("Save the default Tunnel ID for shared workspace switching")
    .requiredOption("--tunnel-id <id>")
    .action(async (opts: { tunnelId: string }) => {
      if (!/^tunnel_[A-Za-z0-9_-]+$/.test(opts.tunnelId)) throw new Error("Invalid Tunnel ID.");
      await withLifecycleLock(async () => {
        assertSharedIdle();
        const { directory, config } = sharedPaths();
        fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
        fs.writeFileSync(config, JSON.stringify({ tunnelId: opts.tunnelId }) + "\n", { mode: 0o600 });
      });
      process.stdout.write("Default shared Tunnel ID saved.\n");
    });
  mcp.command("switch")
    .description("Switch the shared Tunnel ID to another workspace (requires stopped shared runtime)")
    .option("--tunnel-id <id>")
    .requiredOption("-w, --workspace <path>")
    .action(async (opts: { tunnelId?: string; workspace: string }) => {
      const { config } = sharedPaths();
      const saved = fs.existsSync(config) ? JSON.parse(fs.readFileSync(config, "utf8")) as { tunnelId?: string } : null;
      const tunnelId = opts.tunnelId ?? saved?.tunnelId;
      if (!tunnelId) throw new Error("No shared Tunnel ID configured. Run c2c mcp set-tunnel --tunnel-id ... first.");
      const workspace = new Workspace(path.resolve(opts.workspace));
      await withLifecycleLock(() => selectSharedWorkspace(workspace, tunnelId));
      process.stdout.write(`Shared tunnel now targets ${workspace.root} (${workspace.id}).\n`);
    });
  for (const action of ["run", "doctor"] as const) {
    mcp.command(action)
      .description(action === "run" ? "Run this workspace's private tunnel in the foreground" : "Validate this workspace's tunnel-client profile")
      .option("-w, --workspace <path>")
      .option("--shared", "Use the shared profile selected by mcp switch")
      .action(async (opts: { workspace?: string; shared?: boolean }) => {
        if (opts.shared) {
          const { directory, active } = sharedPaths();
          if (!fs.existsSync(active)) throw new Error("No shared workspace selected. Run c2c mcp switch first.");
          const selected = fs.readFileSync(active, "utf8").trim().split("\n");
          const workspace = new Workspace(selected[1]);
          if (workspace.id !== selected[0]) throw new Error("Shared workspace identity changed; switch again.");
          if (opts.workspace && new Workspace(path.resolve(opts.workspace)).id !== workspace.id) throw new Error("Requested workspace does not match shared tunnel selection.");
          const args = [action, "--profile", "c2c-shared", "--profile-dir", directory];
          if (action === "run") {
            const tunnelId = configuredTunnelId();
            if (tunnelId) assertNoLegacyConflict(tunnelId);
            await withSharedLock(async () => { process.exitCode = await runTunnelClient(args); });
          }
          else process.exitCode = await runTunnelClient(args);
          return;
        }
        const workspace = new Workspace(path.resolve(opts.workspace ?? process.cwd()));
        const { profile, directory } = tunnelProfile(workspace);
        process.exitCode = await runTunnelClient([action, "--profile", profile, "--profile-dir", directory]);
      });
  }
}
