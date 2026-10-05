import { Command } from "commander";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { getStateDir } from "../config/paths.js";
import { Workspace } from "../workspace/manager.js";
import { serveStdio } from "./stdio.js";

export function tunnelProfile(workspace: Workspace): { profile: string; directory: string } {
  return {
    profile: `c2c-${workspace.id}`,
    directory: path.join(getStateDir(), "mcp-tunnels"),
  };
}

export function quoteCommandArgument(value: string): string {
  if (/[\r\n\0]/.test(value)) throw new Error("Command arguments cannot contain line breaks or NUL.");
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export function tunnelInitArgs(workspace: Workspace, tunnelId: string): string[] {
  if (!/^tunnel_[A-Za-z0-9_-]+$/.test(tunnelId)) throw new Error("Invalid Tunnel ID.");
  const { profile, directory } = tunnelProfile(workspace);
  const entry = fileURLToPath(new URL("../../bin/c2c.js", import.meta.url));
  const command = [process.execPath, entry, "mcp", "serve", "--workspace", workspace.root]
    .map(quoteCommandArgument).join(" ");
  return [
    "init", "--sample", "sample_mcp_stdio_local", "--profile", profile,
    "--profile-dir", directory, "--tunnel-id", tunnelId, "--mcp-command", command,
    "--health-listen-addr", "127.0.0.1:0",
  ];
}

async function runTunnelClient(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
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
      process.exitCode = code ?? (signal === "SIGINT" ? 130 : 143);
      resolve();
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
      await runTunnelClient(tunnelInitArgs(workspace, opts.tunnelId));
      if (!process.exitCode) {
        const root = quoteCommandArgument(workspace.root);
        process.stdout.write(`\nUse the C2C commands to select the saved profile directory:\n  c2c mcp doctor --workspace ${root}\n  c2c mcp run --workspace ${root}\n`);
      }
    });
  for (const action of ["run", "doctor"] as const) {
    mcp.command(action)
      .description(action === "run" ? "Run this workspace's private tunnel in the foreground" : "Validate this workspace's tunnel-client profile")
      .option("-w, --workspace <path>")
      .action(async (opts: { workspace?: string }) => {
        const workspace = new Workspace(path.resolve(opts.workspace ?? process.cwd()));
        const { profile, directory } = tunnelProfile(workspace);
        await runTunnelClient([action, "--profile", profile, "--profile-dir", directory]);
      });
  }
}
