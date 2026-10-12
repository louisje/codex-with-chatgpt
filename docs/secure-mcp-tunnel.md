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

### Shared Tunnel ID across workspaces (opt-in)

To reuse one ChatGPT connector with different workspaces, stop any running shared runtime first, then select the workspace explicitly:

```sh
c2c mcp switch --tunnel-id tunnel_YOUR_ID --workspace /path/to/project-a
c2c mcp doctor --shared
c2c mcp run --shared
```

Stop `mcp run --shared` before switching to another workspace, then repeat `switch` and `run` with project B. `switch` refuses while the shared runtime holds its PID lock; `run --shared` refuses a second instance. `workspace_info` must be checked after each switch to confirm the expected workspace ID. The existing per-workspace profiles are unchanged. This does **not** hot-switch an active ChatGPT request; calls made during downtime may fail. Avoid running other profiles with the same Tunnel ID concurrently.

### Managed lifecycle (opt-in)

Once per computer, save a shared Tunnel ID:

```sh
c2c mcp set-tunnel --tunnel-id tunnel_YOUR_ID
```

After this, `c2c start` in a workspace automatically configures and starts the shared profile in the background. `c2c doctor` checks whether this workspace owns the running profile; `c2c stop` stops it. To change workspaces, stop the previous workspace first, then `c2c start` in the next one. These commands retain their legacy bridge behavior until a shared Tunnel ID is saved. Existing legacy profile processes are **not** stopped or stolen automatically; an active legacy profile using the same Tunnel ID causes a clear error instead. This prevents takeover of existing ChatGPT connections, but means one-time migration requires explicitly stopping the older process. On Windows, shared-profile process conflict detection is not implemented and automatic activation fails closed.

The process is supervised by a lock under the C2C state directory, with runtime logs in `mcp-tunnels/c2c-shared.log`. An active workspace cannot be switched behind its back. Background startup only confirms the runtime acquired the lock, not that OpenAI has accepted the tunnel or MCP tools can be called; check readiness and `workspace_info` separately.

### Live migration validation (2026-10-12)

An existing C2C-specific legacy profile was explicitly stopped and replaced by
`c2c-shared` using the same Tunnel ID. The existing ChatGPT connector continued
to resolve `workspace_info` without re-pairing. A → B → A switching was
confirmed from ChatGPT itself, not only by local CLI status. A separate running
`terminal-mcp` tunnel using its own Tunnel ID remained online throughout.
Starting an unrelated workspace without stopping the active workspace was
rejected, while re-running `c2c start` for the active workspace was idempotent.

### Readiness hardening (after initial migration)

New managed runtimes pass `--health.url-file` to `tunnel-client`, with a loopback
health listener. `c2c start` now waits for `GET /readyz` to return HTTP success,
not merely for the runtime PID lock to appear. If startup does not become ready,
C2C signals only its own just-spawned wrapper and reports an error. An already
running instance started with older code may not have a health URL file until
it is restarted; this change does not forcibly restart existing connections.

## ChatGPT-first conversation adoption

A pre-existing ChatGPT conversation can be reused without recreating the
shared Tunnel Connector. In the Codex Skill, use **ChatGPT-first Handoff**:
open the user-provided private chat directly using browser tooling, call
`workspace_info` in THAT chat, and compare the returned `workspaceId` with
the local workspace. Only then save the binding:

```bash
c2c session adopt -w /path/to/workspace \
  --url https://chatgpt.com/c/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
  --verified-workspace-id WORKSPACE_ID --json
```

Provide `--project-url` for an existing Project chat; use `--replace` only
with explicit permission if a different conversation is already saved.
Share links are rejected. `session adopt` does not itself access ChatGPT or
read history; remote verification and context review are performed by the
agent in the actual conversation. No connector needs to be recreated.
