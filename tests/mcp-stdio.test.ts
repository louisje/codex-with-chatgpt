import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Workspace } from "../src/workspace/manager.js";
import { quoteCommandArgument, tunnelInitArgs, tunnelProfile } from "../src/mcp/commands.js";
import { cleanup, git, makeGitRepo, makeTmpDir, write } from "./helpers.js";

const entry = fileURLToPath(new URL("../src/cli/index.ts", import.meta.url));
let root: string;
let state: string;
let client: Client | undefined;

beforeEach(() => {
  root = makeTmpDir("stdio space ' quoted");
  state = makeTmpDir("stdio-state");
  vi.stubEnv("C2C_STATE_DIR", state);
  makeGitRepo(root);
});

afterEach(async () => {
  await client?.close();
  client = undefined;
  vi.unstubAllEnvs();
  cleanup(root);
  cleanup(state);
});

async function connect(workspace = root): Promise<Client> {
  const connected = new Client({ name: "stdio-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx/esm", entry, "mcp", "serve", "--workspace", workspace],
    env: { ...process.env, C2C_STATE_DIR: state } as Record<string, string>,
    stderr: "pipe",
  });
  client = connected;
  await connected.connect(transport);
  return connected;
}

describe("stdio MCP", () => {
  it("discovers ten read-only tools and reads files, images and diffs", async () => {
    write(root, "hello.txt", "changed\nsecond\nthird\n");
    fs.writeFileSync(path.join(root, "pixel.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64"));
    const connected = await connect();
    const { tools } = await connected.listTools();
    expect(tools).toHaveLength(10);
    expect(tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
    const info = await connected.callTool({ name: "workspace_info", arguments: {} });
    expect(info.structuredContent?.workspaceId).toBe(new Workspace(root).id);
    const file = await connected.callTool({ name: "read_file", arguments: { path: "hello.txt", start_line: 2, end_line: 2 } });
    expect(file.structuredContent).toMatchObject({ content: "second", nextStartLine: 3 });
    const image = await connected.callTool({ name: "read_image", arguments: { path: "pixel.png" } });
    expect(image.isError).not.toBe(true);
    expect(image.content).toEqual(expect.arrayContaining([expect.objectContaining({ type: "image", mimeType: "image/png" })]));
    const diff = await connected.callTool({ name: "git_diff", arguments: {} });
    expect(diff.structuredContent?.diff).toContain("+changed");
    expect(git(root, "status", "--porcelain")).toContain("hello.txt");
  });

  it("enforces sensitive, ignored, traversal and symlink boundaries", async () => {
    write(root, ".env", "SECRET=hidden");
    write(root, ".c2cignore", "private.txt\n");
    write(root, "private.txt", "hidden");
    write(state, "outside.txt", "outside");
    fs.symlinkSync(path.join(state, "outside.txt"), path.join(root, "escape.txt"));
    const connected = await connect();
    for (const relative of [".env", "private.txt", "../outside.txt", "escape.txt"]) {
      const result = await connected.callTool({ name: "read_file", arguments: { path: relative } });
      expect(result.isError, relative).toBe(true);
    }
  });

  it("preserves identity after restart and isolates another workspace", async () => {
    const first = await connect();
    const before = await first.callTool({ name: "workspace_info", arguments: {} });
    await first.close();
    const restarted = await connect();
    const after = await restarted.callTool({ name: "workspace_info", arguments: {} });
    expect(after.structuredContent?.workspaceId).toBe(before.structuredContent?.workspaceId);
    await restarted.close();
    const other = await connect(state);
    const result = await other.callTool({ name: "read_file", arguments: { path: "hello.txt" } });
    expect(result.isError).toBe(true);
  });

  it.each(["eof", "SIGINT", "SIGTERM"] as const)("exits cleanly on %s", async (reason) => {
    const child = spawn(process.execPath, ["--import", "tsx/esm", entry, "mcp", "serve", "-w", root], { stdio: "pipe" });
    const exited = new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", resolve);
    });
    const ready = new Promise<void>((resolve) => { child.stdout.once("data", () => resolve()); });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "lifecycle", version: "1" } } }) + "\n");
    await ready;
    if (reason === "eof") child.stdin.end();
    else child.kill(reason);
    expect(await exited).toBe(0);
  });
});

describe("workspace tunnel profiles", () => {
  it("uses a stable profile, isolated directory and loopback dynamic port", () => {
    const workspace = new Workspace(root);
    expect(tunnelProfile(workspace)).toEqual(tunnelProfile(new Workspace(path.join(root, "."))));
    expect(tunnelProfile(workspace).profile).not.toBe(tunnelProfile(new Workspace(state)).profile);
    const args = tunnelInitArgs(workspace, "tunnel_example");
    expect(args).toContain("sample_mcp_stdio_local");
    expect(args).toContain("127.0.0.1:0");
    expect(args).not.toContain("--force");
    expect(args[args.indexOf("--mcp-command") + 1]).toContain(quoteCommandArgument(workspace.root));
    expect(() => tunnelInitArgs(workspace, "invalid")).toThrow("Invalid Tunnel ID");
  });
});
