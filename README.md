# Codex with ChatGPT

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md)

**Secure MCP Tunnel (recommended for new setups):** the shared `tunnel-client`
profile can serve multiple workspaces (one at a time) through one ChatGPT
Tunnel Connector. Existing Cloudflare/OAuth installs remain supported as legacy.
See [Secure MCP Tunnel setup](docs/secure-mcp-tunnel.md). An authorized runtime
credential is still required for `tunnel-client`; it is not the ChatGPT web
subscription itself.

> ChatGPT thinks. Codex works.
> ChatGPT 负责思考，Codex 负责干活。

> [!IMPORTANT]
> **遇到问题？** 请先向 Codex 发送 **「更新 Codex with ChatGPT」** 并重试。更新到最新版本可以解决大多数已知问题。  
> **Having trouble?** First ask Codex to **“Update Codex with ChatGPT”** and try again. Updating to the latest version resolves most known issues.

## The problem · 解决什么问题

**中文** — ChatGPT 付费订阅的网页版额度大量闲置，Codex 却在消耗紧张的
API 额度做规划和 Review。本项目把"思考"交给你已付费的网页版 ChatGPT，
Codex 只负责执行。新版连接使用官方 Secure MCP Tunnel，不需要
Cloudflare 反向代理，但需要授权 tunnel-client 的运行凭据。

**EN** — ChatGPT Plus/Pro web quota sits idle while your coding agent burns
scarce API/Codex tokens on planning and review. This project moves the
thinking to the subscription you already pay for; Codex only executes.
The Secure MCP Tunnel needs an authorized runtime credential, but does not
require an API key for ChatGPT model inference or a Cloudflare reverse proxy.

## What it is · 这是什么

**中文** — 把 ChatGPT 网页版变成 Codex 编码会话的"规划与审查大脑"，执行权
完全保留在 Codex 手里。你的仓库永远不会被上传：ChatGPT 通过一条安全的、
**只读** MCP 连接（新版 OpenAI Tunnel 或旧版 OAuth Bridge），按需读取当前工作区里它真正需要的那几行代码。

**EN** — Use the ChatGPT web app as the planning and review brain for your
Codex coding sessions, while Codex keeps full ownership of execution. Your
repository is never uploaded: ChatGPT reads exactly the lines it needs through
a secure, **read-only** MCP connection (OpenAI Tunnel or legacy OAuth bridge) to your current
workspace.

**Languages:** [English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md)

Detailed docs below are in English. 中文完整說明：**[繁體中文](README.zh-TW.md)** · **[简体中文](README.zh-CN.md)**

## One-paste install · 一段话安装

**中文** — 不懂 git、Node、终端？完全不需要懂。把下面这段话原样复制给你的
编码 Agent（Codex），然后去倒杯咖啡：

```text
请帮我安装并配置 Codex with ChatGPT，优先使用 Secure MCP Tunnel，由你完成所有可自动执行的步骤：

1. 检查 git、Node.js >= 20 和 corepack；缺少依赖时使用适合当前系统的包管理器安装。不要为了新版连接方式安装 cloudflared。
2. 克隆或更新 https://github.com/louisje/codex-with-chatgpt 到 ~/codex-with-chatgpt；若目录已有其他内容或未提交修改，先检查并保护现有数据，不得强制覆盖。
3. 在仓库中运行 corepack pnpm install 与 corepack pnpm build。
4. 根据 CODEX_HOME（未设置时使用 ~/.codex；Windows 为 %USERPROFILE%\.codex）安装 skill/SKILL.md 至 <codex-home>/skills/codex-with-chatgpt/SKILL.md，并替换其中 checkout lives at 的路径为实际目录。阅读新版 Skill 的 Transport selection。
5. 优先选择 Secure MCP Tunnel：检查 tunnel-client 是否已安装与正确授权；缺少时根据官方说明引导安装。检查机器上是否已有 C2C 的 Tunnel ID；有则复用，没有则请我创建/提供 OpenAI Tunnel ID，并在 ChatGPT 中完成一次 Tunnel Connector 授权。不要复用 terminal-mcp 等无关 Tunnel ID，也不要编造凭证。
6. 使用 c2c mcp set-tunnel --tunnel-id <ID> 保存一次；对当前工作区执行 c2c start -w <workspace>，再执行 c2c doctor -w <workspace> --no-fix --json。通过后，在 ChatGPT 连接器实际调用 workspace_info，确认工作区身份。后续切换工作区时，先停止原工作区，再启动新工作区；无需每次新建 Connector。
7. 如果已配置 Legacy Cloudflare 模式，保留现有设置；只有我明确选择旧版模式时，才按 Skill 的 Legacy 步骤使用 cloudflared、OAuth 和配对码。不要自动迁移、删除 Connector 或破坏运行中的其他 Tunnel。
8. 只有需要登录、授权、Tunnel ID、验证码或额外权限时才请我操作，每次告诉我一个明确步骤。完成后列出安装和验证结果；遇到问题先自行诊断，不要输出任何密钥。
```


**EN** — Don't know git, Node, or terminals? You don't need to. Copy the
paragraph below, paste it to your coding agent (Codex), and go grab a coffee:

```text
Please install and configure Codex with ChatGPT using Secure MCP Tunnel when possible. Perform all safe automated steps:

1. Check for git, Node.js >= 20 and corepack; install missing prerequisites using the OS package manager. Do not install cloudflared merely for the new tunnel mode.
2. Clone or update https://github.com/louisje/codex-with-chatgpt at ~/codex-with-chatgpt. Inspect existing directories and uncommitted changes first; never overwrite user data.
3. In the checkout run corepack pnpm install and corepack pnpm build.
4. Determine Codex home from CODEX_HOME or ~/.codex (Windows: %USERPROFILE%\.codex). Install skill/SKILL.md in <codex-home>/skills/codex-with-chatgpt/SKILL.md, replacing the checkout lives at placeholder with the actual path. Read the new Skill's Transport selection section.
5. Prefer Secure MCP Tunnel. Check that tunnel-client is installed and authorized; use the official installation guidance if missing. Reuse an existing C2C Tunnel ID if configured. Otherwise ask me to create/provide an OpenAI Tunnel ID and authorize a Tunnel Connector in ChatGPT once. Never reuse an unrelated terminal-mcp Tunnel ID or invent credentials.
6. Save the ID once with c2c mcp set-tunnel --tunnel-id <ID>. For my workspace run c2c start -w <workspace> and c2c doctor -w <workspace> --no-fix --json. Then call workspace_info through the actual ChatGPT connector to confirm workspace identity. To switch workspaces later, stop the previous one before starting the next; reuse the same Connector.
7. Preserve existing Legacy Cloudflare installs. Only when I explicitly choose legacy mode, follow the Skill's Legacy steps for cloudflared, OAuth and pairing. Do not silently migrate, delete connectors or interrupt unrelated running tunnels.
8. Ask for my action only when login, authorization, Tunnel ID, CAPTCHA or extra permissions are necessary, one clear step at a time. Report the installation and actual verification results. Diagnose failures without exposing secrets.
```


**繁體中文** — 將以下 Prompt 貼給 Codex，即可交由 AI agent 引導完成安裝：

```text
請幫我安裝並設定 Codex with ChatGPT，優先使用 Secure MCP Tunnel，由你完成所有可以自動執行的步驟：

1. 檢查 git、Node.js >= 20 及 corepack；缺少依賴時，使用適合目前系統的套件管理器安裝。新版連線方式不需要安裝 cloudflared。
2. Clone 或更新 https://github.com/louisje/codex-with-chatgpt 至 ~/codex-with-chatgpt；若目錄已有其他內容或未提交修改，先檢查並保護現有資料，不得強制覆寫。
3. 在專案目錄執行 corepack pnpm install 與 corepack pnpm build。
4. 依 CODEX_HOME（未設定時為 ~/.codex；Windows 為 %USERPROFILE%\.codex）將 skill/SKILL.md 安裝至 <codex-home>/skills/codex-with-chatgpt/SKILL.md，並將 checkout lives at 所在行更新為實際專案路徑。先閱讀新版 Skill 的 Transport selection。
5. 優先採用 Secure MCP Tunnel：確認 tunnel-client 已安裝並正確授權；若尚未安裝，依官方說明協助安裝。檢查本機是否已有 C2C Tunnel ID，有就沿用，沒有則請我建立或提供 OpenAI Tunnel ID，並在 ChatGPT 完成一次 Tunnel Connector 授權。不可挪用 terminal-mcp 等其他 Tunnel ID，也不可虛構憑證。
6. 使用 c2c mcp set-tunnel --tunnel-id <ID> 儲存一次；在目前工作區執行 c2c start -w <workspace>，再執行 c2c doctor -w <workspace> --no-fix --json。確認成功後，實際透過 ChatGPT Connector 呼叫 workspace_info，驗證工作區身分。日後切換工作區時，先停止原工作區再啟動新工作區，不需重新建立 Connector。
7. 若原本採用 Legacy Cloudflare，保留既有設定；只有我明確選擇舊版模式時，才依 Skill 的 Legacy 步驟使用 cloudflared、OAuth 與配對碼。不要自動遷移、刪除 Connector，或中斷其他運作中的 Tunnel。
8. 只有登入、授權、Tunnel ID、驗證碼或額外權限確實需要我介入時，才逐一告知操作步驟。完成後列出安裝與驗證結果；發生問題先自行診斷，不要輸出任何密鑰。
```

**Updates · 更新** — The Skill checks GitHub once a day and updates itself when a
new version is released; no action needed. You can also say "更新 Codex with ChatGPT"
anytime. / Skill 每天自动检查一次 GitHub，有新版本会自动更新，无需任何操作；
也可以随时对 Codex 说"更新 Codex with ChatGPT"。

---

*The sections below are in English. 以下详细内容为英文，中文完整版见
[README.zh-TW.md](README.zh-TW.md)／[README.zh-CN.md](README.zh-CN.md)。*

## Install → Setup → Use (manual)

Let `<codex-home>` be a non-empty `CODEX_HOME` when set; otherwise use `~/.codex`
(`%USERPROFILE%\.codex` on Windows).

1. Install the Codex Skill: copy `skill/` to `<codex-home>/skills/codex-with-chatgpt/`.
2. Tell Codex: **"Set up Codex with ChatGPT."** (中文: "使用 Codex with ChatGPT 完成首次配置。")
3. Use Codex normally: **"Use Codex with ChatGPT to implement XXX."**

> **Installation scope:** This repository does not publish or install a Codex
> Web GPT, launcher, or model-catalog entry. Installation consists of building
> this checkout, installing `skill/SKILL.md` as a Codex Skill, and using `c2c mcp set-tunnel` / `c2c start` for the recommended
> Secure MCP Tunnel. Existing Cloudflare installs may still use `c2c setup`. For Web GPT or model-catalog
> problems, see [troubleshooting](docs/troubleshooting.md).

That's the whole manual. You don't need to know what MCP, OAuth, tunnels,
ports or localhost are — Codex configures everything automatically and you
just see:

```
Codex with ChatGPT

✓ Project detected
✓ Secure MCP Tunnel ready
✓ Secure connection established
✓ ChatGPT connected
✓ File read test passed

Ready.
```

The only steps that may need you: signing into ChatGPT and, for Secure MCP
Tunnel, creating/authorizing the Tunnel ID and runtime credential. Cloudflare
login is relevant only to the legacy connection mode. A **new** workspace also asks
you to create a ChatGPT Project (collection) once — pick **project-only
memory**, name it after the workspace. If the sidebar has no Projects row,
hover **Chats**, open the … menu, and choose **Organize by project**. Codex
then saves that collection link and starts chats from that page. Existing
workspaces that already have a C2C chat stay on the old one-conversation
style until you ask to switch.

### Optional stable hostname (legacy Cloudflare only)

In legacy Cloudflare mode, the default public address is a temporary URL. It changes when the
bridge restarts, and Codex repairs ChatGPT by deleting that workspace's
connector and adding it again.

If you have a Cloudflare account and a domain already on Cloudflare, first-time
setup (and the next coding session, once) will ask whether you want a stable
hostname such as `c2c-<project>.your-domain.com`. That path opens a browser so
you can authorize Cloudflare. After that, the ChatGPT connector keeps working
across restarts. If you skip it, or the login fails, Codex stays on the temporary
address — same features, just a slower repair.

Credentials stay in the OS app state directory, not in the project.

## How it works

```
             ┌───────────────────────────┐
             │       ChatGPT Web         │
             │  Reason / Plan / Review   │
             └──────────┬──────────▲─────┘
                        │          │
               MCP      │          │ Computer Use
            Data Plane  │          │ Control Plane (<1 KB messages)
                        ▼          │
             ┌─────────────────────┐
             │      C2C Bridge     │   loopback-only HTTP server
             │  read-only MCP      │   OAuth 2.1 + one-time pairing code
             │  OAuth + Pairing    │   Cloudflare Quick Tunnel
             │  Tunnel Manager     │
             └──────────┬──────────┘
                        │  read-only
                        ▼
             ┌─────────────────────┐          ┌─────────────────────┐
             │   Local Workspace   │◀─────────│    Codex Harness    │
             └─────────────────────┘ edit/git │ shell / tests / fix │
                                              └─────────────────────┘
```

- **Control plane (Computer Use)**: Codex and ChatGPT exchange tiny structured
  `[C2C]` state messages — `INIT → PLAN → EXECUTED → REVIEW → DONE`. No diffs,
  no logs, no file bodies are ever pasted.
- **Data plane (MCP)**: ChatGPT pulls what it needs itself through 10 read-only
  tools: `workspace_info`, `list_directory`, `read_file`, `search_workspace`,
  `git_status`, `git_diff`, `test_status`, `execution_summary`,
  `execution_output`, `read_image`.
- **Independent review**: after Codex executes, ChatGPT inspects the actual
  git diff and test records through MCP — it never trusts "all tests passed"
  claims blindly.

### Generated media handoff

The connector remains read-only: `read_image` can inspect supported workspace
images but cannot write files. After a requested image or video is downloaded
through the visible ChatGPT UI, the local executor can validate and import the
original with `c2c asset import -w <workspace> --from <download> --to <new-path>`.
Imports are workspace-contained, signature-checked, size-limited, reject active
SVG content, and never overwrite an existing file.

## Security model (short version)

- **Read-only by construction**: write/delete/shell/commit tools simply do not
  exist on the server. No prompt injection can enable them.
- **One workspace = one boundary**: every token is bound to a single workspace;
  path containment uses canonical realpaths (symlink/`../`/absolute-path escapes
  are all blocked and tested).
- **Sensitive files never leave**: `.env*`, keys, SSH, credentials are denied by
  default (`.env.example` allowed); `.c2cignore` adds your own rules.
- **Knowing the URL grants nothing**: the public MCP endpoint requires OAuth 2.1
  (PKCE S256, dynamic client registration, rotating refresh tokens). Without a
  token: 401. Wrong workspace: 403.
- **The model never sees long-lived credentials**: the only secret that ever
  touches a browser is a one-time pairing code (5-minute TTL, 5 attempts,
  rate-limited, destroyed on use).

Full threat model: [docs/security.md](docs/security.md)

## For developers

```bash
pnpm install
pnpm build          # -> dist/, exposes the `c2c` bin
pnpm test           # vitest: 150 tests (path security, OAuth, pairing, MCP e2e)

c2c mcp set-tunnel  # set shared Tunnel ID once (supply --tunnel-id)
c2c start / doctor / stop # managed shared runtime once configured
c2c setup           # legacy Bridge + Cloudflare + OAuth pairing
c2c sandbox-allow   # whitelist the settings dir in Codex (macOS + Windows)
c2c status / doctor / pair / unpair / logs / stop
```

Requirements: Node.js >= 20, git. For Secure MCP Tunnel, install and authorize
`tunnel-client` and create a Tunnel Connector in ChatGPT. In legacy mode, `cloudflared` is required for the public connection
(auto-detected; the Skill installs it for you). If QUIC is blocked, set
`C2C_TUNNEL_PROTOCOL=http2` and restart the bridge.

Docs: [architecture](docs/architecture.md) · [protocol](docs/protocol.md) ·
[security](docs/security.md) · [troubleshooting](docs/troubleshooting.md)

## Project layout

```
src/
  bridge/     loopback HTTP server, port recovery, admin API
  mcp/        10 read-only tools; stdio / managed Secure MCP Tunnel + HTTP
  auth/       OAuth 2.1 (PKCE, DCR, refresh rotation, revocation)
  pairing/    one-time pairing codes (CSPRNG, TTL, rate limits)
  workspace/  path containment, sensitive-file policy, search, git
  tunnel/     TunnelProvider abstraction + Cloudflare Quick/Named Tunnel
  execution/  execution records for the review loop
  process/    daemon lifecycle
  cli/        the c2c CLI
skill/        the Codex Skill (the real UX layer)
tests/        unit + integration tests
docs/         architecture / protocol / security / troubleshooting
```

## Status & disclaimer

V1. Secure MCP Tunnel with shared workspace switching has been verified through
the actual ChatGPT connector (A → B → A). Legacy Bridge, OAuth and Cloudflare
workflows remain supported. First-time Tunnel authorization requires user action.

**Unofficial community project. Not affiliated with or endorsed by OpenAI.**

## License

[MIT](LICENSE)

## Star History

<a href="https://www.star-history.com/?repos=xiaoduoya%2Fcodex-with-chatgpt&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=xiaoduoya/codex-with-chatgpt&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=xiaoduoya/codex-with-chatgpt&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=xiaoduoya/codex-with-chatgpt&type=date&legend=top-left" />
 </picture>
</a>
