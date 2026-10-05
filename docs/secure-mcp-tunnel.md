# Secure MCP Tunnel (preview)

This opt-in transport runs the existing ten read-only workspace tools through
`tunnel-client` and stdio. It does not start the HTTP bridge, Cloudflare, or the
C2C OAuth/pairing flow. Workspace path, sensitive-file, ignore and size limits
still apply. Tunnel access is controlled by OpenAI.

Build the checkout before configuring a tunnel:

```sh
pnpm install
pnpm build
node bin/c2c.js mcp configure --workspace /absolute/workspace --tunnel-id tunnel_YOUR_ID
node bin/c2c.js mcp doctor --workspace /absolute/workspace
node bin/c2c.js mcp run --workspace /absolute/workspace
```

Install `tunnel-client` separately and create a tunnel in Platform tunnel
settings. Supply its runtime credential through `CONTROL_PLANE_API_KEY` in the
environment used to run the client. C2C does not copy or store the API key.
See the [official setup guide](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels).

Configure once per workspace. The generated profile lives under the C2C state
directory's `mcp-tunnels` folder. Its name is based on the canonical workspace
identity; restarting or opening another ChatGPT conversation or Project reuses
the profile and Tunnel ID. Reconfiguration refuses to overwrite an existing
profile. Moving the workspace changes its identity and requires configuration
again. Use separate Tunnel IDs for workspaces that must run simultaneously.

Keep `mcp run` running, select **Tunnel** when creating the ChatGPT connection,
and select the same Tunnel ID. The health/admin listener uses an available
loopback port, reported by tunnel-client. `mcp doctor` checks configuration;
it does not prove that ChatGPT can discover tools or that a running tunnel is
ready. Verify readiness through tunnel-client's local `/readyz` endpoint and
test `workspace_info` from ChatGPT.

For another stdio client, the server command is:

```sh
node /absolute/codex-with-chatgpt/bin/c2c.js mcp serve --workspace /absolute/workspace
```

The server reserves stdout for MCP messages and sends diagnostics to stderr.
It shuts down on stdin EOF, SIGINT, or SIGTERM.

This is the first migration stage. Existing `start`, `doctor`, `stop`, connector
automation and the browser Skill still manage the legacy Cloudflare bridge;
use the `mcp` commands above for this preview. Conversation/Project bindings
remain independent of transport. Automatic adoption of an existing ChatGPT
conversation and background tunnel lifecycle management are not included yet.
