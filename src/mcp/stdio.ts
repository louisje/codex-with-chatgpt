import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Workspace } from "../workspace/manager.js";
import { Logger } from "../logger/index.js";
import { createMcpServer } from "./server.js";

export async function serveStdio(workspaceRoot: string): Promise<void> {
  const workspace = new Workspace(workspaceRoot);
  const logger = new Logger({ name: "mcp-stdio", console: true, file: null });
  const server = createMcpServer({ workspace, logger });
  const transport = new StdioServerTransport();
  const shutdown = (): void => {
    void server.close().catch((error: unknown) => {
      logger.error("Failed to close MCP server", String(error));
      process.exitCode = 1;
    });
  };
  server.server.onclose = () => {
    process.removeListener("SIGINT", shutdown);
    process.removeListener("SIGTERM", shutdown);
    process.stdin.removeListener("end", shutdown);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  process.stdin.once("end", shutdown);
  try {
    await server.connect(transport);
  } catch (error) {
    await server.close();
    throw error;
  }
}
