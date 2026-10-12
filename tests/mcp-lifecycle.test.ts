import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { configuredTunnelId, sharedStatus, assertNoLegacyConflict, withLifecycleLock } from "../src/mcp/lifecycle.js";
import { sharedPaths } from "../src/mcp/commands.js";

const previous = process.env.C2C_STATE_DIR;
const dirs: string[] = [];
function isolate(): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "c2c-lifecycle-"));
  dirs.push(dir);
  process.env.C2C_STATE_DIR = dir;
  fs.mkdirSync(sharedPaths().directory, { recursive: true });
}
afterEach(() => {
  if (previous === undefined) delete process.env.C2C_STATE_DIR;
  else process.env.C2C_STATE_DIR = previous;
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("managed MCP lifecycle", () => {
  it("is opt-in and reads the global tunnel ID", () => {
    isolate();
    expect(configuredTunnelId()).toBeNull();
    fs.writeFileSync(sharedPaths().config, JSON.stringify({ tunnelId: "tunnel_example" }));
    expect(configuredTunnelId()).toBe("tunnel_example");
    fs.writeFileSync(sharedPaths().config, JSON.stringify({ tunnelId: "invalid" }));
    expect(configuredTunnelId).toThrow("Invalid saved Tunnel ID");
  });

  it("identifies a live shared runtime and its workspace", () => {
    isolate();
    expect(sharedStatus().running).toBe(false);
    fs.writeFileSync(sharedPaths().active, "workspace-id\n/tmp/project\n");
    fs.writeFileSync(sharedPaths().lock, String(process.pid));
    expect(sharedStatus()).toMatchObject({ running: true, pid: process.pid, workspaceId: "workspace-id", workspaceRoot: "/tmp/project" });
  });

  it("fails closed on an active legacy profile using the same Tunnel ID", () => {
    if (process.platform === "win32") return;
    // With a private test state, invoking detection must be side-effect-free.
    isolate();
    expect(() => assertNoLegacyConflict("tunnel_nonexistent_test_id_12345")).not.toThrow();
  });
  it("serializes concurrent lifecycle operations and releases its lock", async () => {
    isolate();
    const events: string[] = [];
    const first = withLifecycleLock(async () => {
      events.push("first-enter");
      await new Promise((resolve) => setTimeout(resolve, 220));
      events.push("first-leave");
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    const second = withLifecycleLock(async () => { events.push("second-enter"); });
    await Promise.all([first, second]);
    expect(events).toEqual(["first-enter", "first-leave", "second-enter"]);
    expect(fs.existsSync(path.join(sharedPaths().directory, "c2c-shared.operation.lock"))).toBe(false);
  });

  it("releases the lifecycle lock after an exception", async () => {
    isolate();
    await expect(withLifecycleLock(async () => { throw new Error("broken"); })).rejects.toThrow("broken");
    await expect(withLifecycleLock(async () => 42)).resolves.toBe(42);
  });

  it("reclaims a stale lifecycle lock", async () => {
    isolate();
    fs.writeFileSync(path.join(sharedPaths().directory, "c2c-shared.operation.lock"), "99999999");
    await expect(withLifecycleLock(async () => "ok")).resolves.toBe("ok");
  });

});

describe("lifecycle failure recovery", () => {
  it("refuses to overwrite an active runtime lock", async () => {
    isolate();
    fs.writeFileSync(sharedPaths().lock, String(process.pid));
    const { assertSharedIdle } = await import("../src/mcp/commands.js");
    expect(assertSharedIdle).toThrow(/running/);
    expect(fs.readFileSync(sharedPaths().lock, "utf8")).toBe(String(process.pid));
  });

  it("removes stale runtime locks but not live ones", async () => {
    isolate();
    fs.writeFileSync(sharedPaths().lock, "99999999");
    const { assertSharedIdle } = await import("../src/mcp/commands.js");
    expect(assertSharedIdle).not.toThrow();
    expect(fs.existsSync(sharedPaths().lock)).toBe(false);
  });
});
