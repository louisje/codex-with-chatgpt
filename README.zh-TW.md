# Codex with ChatGPT

[English](README.md) | **繁體中文** | [简体中文](README.zh-CN.md)

> ChatGPT 負責思考，Codex 負責執行。

> [!IMPORTANT]
> 遇到問題時，請先向 Codex 說「更新 Codex with ChatGPT」，再重新嘗試。這是非官方社群專案，與 OpenAI 無關，也未獲得 OpenAI 背書。

## 解決什麼問題？

讓 ChatGPT 網頁版協助 Codex 做規劃、推理和程式碼審查，Codex 則保留編輯檔案、執行測試與 Git 操作的權限。這樣可以善用既有的 ChatGPT 訂閱，而不必將每一步的思考與審查都交給 Coding Agent。

## 這是什麼？

Codex with ChatGPT（C2C）讓 ChatGPT 透過**唯讀 MCP 工具**，按需檢視目前的本機工作區；程式碼不需要整個上傳為 ChatGPT Project 的來源檔案。Codex 仍是唯一負責本機修改、測試與提交的執行端。

目前有兩種連線方式：

- **Secure MCP Tunnel（新安裝建議使用）**：以 OpenAI 的 `tunnel-client` 建立連線，多個 workspace 共用一個 Tunnel ID 與 ChatGPT Connector，但同一時間只連接一個 workspace。首次設定需要 Tunnel ID、授權過的 runtime 憑證與 ChatGPT Connector 授權；不需要 Cloudflare。
- **Legacy Cloudflare Bridge（相容模式）**：原作者設計的本機 HTTP Bridge、Cloudflare Tunnel、OAuth 及一次性配對碼。既有使用者可以繼續使用，不會自動遷移。

詳細技術說明請參考 [Secure MCP Tunnel 文件](docs/secure-mcp-tunnel.md)。**不同 `tunnel-client` profile 只要使用不同的 Tunnel ID，就能同時運作**；C2C 不會因切換 workspace 而停止其他服務（例如 `terminal-mcp`）。

## 一段話安裝：交給 AI Agent 自動完成

不熟悉 Git、Node.js 或終端機也可以使用。將下面整段 Prompt 貼給 Codex，讓 Agent 依照實際環境安裝、設定並驗證；只有需要人為授權時才請你介入。

```text
請幫我安裝並設定 Codex with ChatGPT，優先使用 Secure MCP Tunnel，由你完成所有可以自動執行的步驟：

1. 檢查 git、Node.js >= 20 及 corepack；缺少依賴時，使用適合目前系統的套件管理器安裝。新版連線方式不需要安裝 cloudflared。
2. 先建立 ~/projects 目錄，再 Clone 或更新 https://github.com/louisje/codex-with-chatgpt 至 ~/projects/codex-with-chatgpt；若目錄已有其他內容或未提交修改，先檢查並保護現有資料，不得強制覆寫。
3. 在專案目錄執行 corepack pnpm install 與 corepack pnpm build。
4. 依 CODEX_HOME（未設定時為 ~/.codex；Windows 為 %USERPROFILE%\.codex），在 <codex-home>/skills/codex-with-chatgpt 建立指向專案 skill/ 目錄的符號連結（Windows 可使用目錄 junction）。如果目標已存在，先檢查，不可直接覆寫；也不要修改 repository 內的 SKILL.md。閱讀 Skill 的 Transport selection。
5. 優先採用 Secure MCP Tunnel：確認 tunnel-client 已安裝並正確授權；若尚未安裝，依官方說明協助安裝。檢查本機是否已有 C2C Tunnel ID，有就沿用，沒有則請我建立或提供 OpenAI Tunnel ID，並在 ChatGPT 完成一次 Tunnel Connector 授權。不可挪用 terminal-mcp 等其他 Tunnel ID，也不可虛構憑證。
6. 使用 c2c mcp set-tunnel --tunnel-id <ID> 儲存一次；在目前工作區執行 c2c start -w <workspace>，再執行 c2c doctor -w <workspace> --no-fix --json。確認成功後，實際透過 ChatGPT Connector 呼叫 workspace_info，驗證工作區身分。日後切換工作區時，先停止原工作區再啟動新工作區，不需重新建立 Connector。
7. 若原本採用 Legacy Cloudflare，保留既有設定；只有我明確選擇舊版模式時，才依 Skill 的 Legacy 步驟使用 cloudflared、OAuth 與配對碼。不要自動遷移、刪除 Connector，或中斷其他運作中的 Tunnel。
8. 只有登入、授權、Tunnel ID、驗證碼或額外權限確實需要我介入時，才逐一告知操作步驟。完成後列出安裝與驗證結果；發生問題先自行診斷，不要輸出任何密鑰。```

**安裝完成後的更新方式：** 向 Codex 說「更新 Codex with ChatGPT」，由 Skill 檢查新版並更新；已安裝的 Skill 通常會定期檢查更新。

## 安裝 → 設定 → 使用（手動方式）

先確定 `<codex-home>`：若設定了非空的 `CODEX_HOME`，使用其值；否則使用 `~/.codex`（Windows 通常為 `%USERPROFILE%\.codex`）。

1. 安裝 Git、Node.js 20 或以上版本與 Corepack；建置需要 `pnpm`（透過 Corepack 取得）。
2. Clone [此 fork](https://github.com/louisje/codex-with-chatgpt) 並執行 `corepack pnpm install`、`corepack pnpm build`。
3. 將 `<codex-home>/skills/codex-with-chatgpt` 符號連結至 `<checkout>/skill`（Windows 可改用目錄 junction），不需要複製或修改 `SKILL.md`。若該位置已有資料，先確認內容及備份，再決定是否替換。
4. 依照 Skill 的 **Transport selection** 決定使用新版 Secure MCP Tunnel 或既有 Legacy Bridge；不要同時設定兩種模式來使用相同 Tunnel ID。
5. 首次使用 Secure MCP Tunnel 時，建立 OpenAI Tunnel ID，安裝並授權 `tunnel-client`，在 ChatGPT 新增與該 ID 對應的 Tunnel Connector。這一步可能需要你操作介面；**請勿把 API key 貼進對話**。
6. 在 C2C 專案目錄使用以下指令（將範例欄位換成實際資料）：

```bash
node bin/c2c.js mcp set-tunnel --tunnel-id tunnel_YOUR_ID
node bin/c2c.js start -w /absolute/path/to/workspace --json
node bin/c2c.js doctor -w /absolute/path/to/workspace --no-fix --json
```

當 `doctor` 回報 `ok: true` 且 `report.tunnel.ok: true`，再從 ChatGPT 的同一個 Connector 呼叫 `workspace_info`，確認它回報的工作區正確。**本機健康檢查不等於 ChatGPT 端實際可讀取**，兩者都應該驗證。

> **安裝範圍：** 這個 repository 提供 C2C CLI、Codex Skill 與唯讀 MCP Server；它不會在 ChatGPT 裡建立一個新的模型，也不會自動替你建立 OpenAI API 金鑰。既有 Legacy 安裝仍可使用 `c2c setup` 設定 Cloudflare 與 OAuth 連接器。

## 在不同 Workspace 之間切換

Secure MCP Tunnel 只使用一個共用 Connector，因此必須先停止原工作區，再啟動另一個：

```bash
node bin/c2c.js stop -w /path/to/workspace-a
node bin/c2c.js start -w /path/to/workspace-b
node bin/c2c.js doctor -w /path/to/workspace-b --no-fix --json
```

之後在 ChatGPT 呼叫 `workspace_info`，確認目前已指向 B。若 B 已經在運作，重複執行 `start` 可以沿用現有執行個體；若 A 仍在運作，直接 `start` B 會被拒絕，不會暗中奪走連線。切換不會改寫 ChatGPT 對話內容或 Project 歸屬。請為各工作區維護適合的 ChatGPT 對話或 Project。

## 工作原理

```text
 ChatGPT 網頁版（規劃與審查）
          │
          │ 唯讀 MCP
          ▼
  Secure MCP Tunnel Connector ─────── OpenAI Tunnel ID
          │                                   │
          ▼                                   ▼
     tunnel-client                    同時僅指向一個 workspace
          │
          ▼
 C2C MCP stdio server ─────────► 本機工作區（唯讀）
                                         ▲
                                         │ 編輯 / Git / 測試
                                   Codex Agent
```

- **控制面**：Codex 與 ChatGPT 透過 `[C2C]` 訊息交換規劃、執行與審查狀態；不需要把完整 diff 或日誌貼到對話。
- **資料面**：ChatGPT 透過 10 個唯讀 MCP 工具存取工作區，包括 `workspace_info`、`list_directory`、`read_file`、`search_workspace`、`git_status`、`git_diff`、`test_status`、`execution_summary`、`execution_output`、`read_image`。
- **權限界線**：唯讀 MCP Server 無法修改本機程式碼。寫入、執行 Shell 與提交一律由 Codex 負責。
- **舊版架構**：Cloudflare 模式仍採本機 HTTP Bridge、OAuth 2.1 與配對碼，不需為已存在的工作區強制改用新版。

### 圖片、影片等媒體的交接

Connector 本身仍是唯讀。`read_image` 可以檢視工作區內支援的圖片，不能直接寫入檔案。若透過 ChatGPT 介面取得使用者要求的媒體檔案，可由本機執行端呼叫：

```bash
node bin/c2c.js asset import -w /path/to/workspace --from /path/to/download --to new/relative/path
```

匯入會檢查檔案格式、大小與路徑，不覆寫既有檔案，並拒絕不安全的 SVG 內容。

## 安全模型

- **設計上唯讀**：MCP Server 不提供寫檔、刪檔、Shell 或 Git commit 等工具。
- **工作區隔離**：路徑先經過正規化及邊界檢查，防止利用符號連結或 `../` 讀取工作區外的檔案。
- **機密檔案保護**：預設阻擋 `.env*`、SSH 私鑰與其他敏感憑證，可使用 `.c2cignore` 加入自訂規則。
- **Tunnel 認證**：Secure MCP Tunnel 使用 OpenAI Tunnel ID 與 runtime 授權；Tunnel ID 不是可以取代 runtime 憑證的秘密。不要把任何 API key、權杖或 Cookie 貼到 ChatGPT。
- **Legacy 模式**：HTTP 端點使用 OAuth 2.1、短效配對碼與相關存取控制。這些機制**不適用於**新版 Tunnel Connector 的設定流程。

更完整的討論請參考 [安全文件](docs/security.md)。

## 開發者資訊

```bash
corepack pnpm install
corepack pnpm build
corepack pnpm test
corepack pnpm typecheck

# Secure MCP Tunnel（設定一次 Tunnel ID）
node bin/c2c.js mcp set-tunnel --tunnel-id tunnel_YOUR_ID
node bin/c2c.js start -w /path/to/workspace
node bin/c2c.js doctor -w /path/to/workspace --no-fix --json
node bin/c2c.js stop -w /path/to/workspace

# 僅 Legacy Cloudflare 模式
node bin/c2c.js setup -w /path/to/workspace
```

需求：Node.js 20 以上版本、Git、Corepack。新版 Secure MCP Tunnel 需要已安裝並授權的 `tunnel-client`；舊版 Cloudflare 則需要 `cloudflared`。Ubuntu、macOS、Windows 的實際安裝方式可���不同，請以工具的官方支援平台與文件為準。

主要目錄：`src/mcp/` 為唯讀 MCP Server 與共用 Tunnel 管理；`src/bridge/`、`src/auth/`、`src/pairing/` 為 Legacy Bridge；`src/workspace/` 為工作區安全存取；`src/cli/` 為 CLI；`skill/` 為 Codex Skill；`tests/` 為測試。

延伸閱讀：[架構](docs/architecture.md) · [協定](docs/protocol.md) · [安全性](docs/security.md) · [問題排除](docs/troubleshooting.md) · [Secure MCP Tunnel](docs/secure-mcp-tunnel.md)

## 專案來源與聲明

本專案基於 [XiaoDuoYa/codex-with-chatgpt](https://github.com/XiaoDuoYa/codex-with-chatgpt) 的設計與程式碼，這個 fork 加入 Secure MCP Tunnel 共用連線及相關文件。原作者提出「一段 Prompt 交給 Coding Agent 安裝」的使用方式，在這個版本繼續保留。

**非官方社群專案，與 OpenAI 無關，亦未獲其背書。**

## 授權條款

[MIT](LICENSE)
