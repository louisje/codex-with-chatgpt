# 待辦事項

## P0 — Secure MCP Tunnel 端到端驗證

- [x] 建立獨立 C2C Tunnel 與 `c2c-c7a1341b2d81` profile；`c2c mcp doctor` 全部必要檢查通過（2026-10-12）。
- [x] `c2c mcp run` 已啟動、`/readyz` 回傳 ready，ChatGPT 端透過新連接器成功呼叫 `workspace_info`，workspace ID 為 `c7a1341b2d81`（2026-10-12）。
- [x] 實際切換並重新啟動 C2C tunnel-client，多次透過同一 ChatGPT connector 呼叫 `workspace_info` 成功，無須重新配對（2026-10-12）。
- [ ] 測試既有一般 ChatGPT 對話接續：不建立新 Chat 或 Project，從同一對話讓 Codex 接手。

## P1 — 單一 Tunnel、多 workspace 切換

- [x] 新增 opt-in `c2c mcp switch --tunnel-id ... --workspace ...`，使用 `c2c-shared` profile；既有 workspace profiles 不變。
- [x] shared runtime 採 PID lock 防止同時執行，切換前檢查 lock；失敗時回復 profile。仍需跨 profile 同 Tunnel ID 衝突檢查。
- [ ] 切換後由 `workspace_info` 核對 workspace ID 與 root，確認 ChatGPT 讀到新 workspace；失敗時回復原設定。
- [ ] 補足切換、重啟、互斥與錯誤復原整合測試；目前僅驗證參數產生及 stdio 測試（7 項通過）。

## P2 — 正式整合

- [x] `c2c start/doctor/stop` 已支援 opt-in shared Tunnel ID 生命週期，舊 bridge 路徑保留。
- [ ] 增加管理程序啟動／停止、衝突偵測、stale lock、安全切換整合測試；跨平台支援待完善。
- [ ] 更新 `skill/SKILL.md`：優先使用既有 Tunnel profile，僅 legacy Cloudflare 路徑使用 OAuth、pairing 與 connector repair。
- [ ] 補上 profile 缺失、Tunnel ID 重用、重啟、連線中斷及多 workspace 隔離的測試。

## P3 — 文件與清理

- [ ] 更新 README、架構與故障排除文件，清楚區分正式與 legacy 流程。
- [ ] 完成端到端驗證後，再評估退役 Cloudflare 舊程式碼。

## 開發環境備註

- 可使用 `corepack pnpm` 執行測試與建置；2026-10-12 全套 206 項測試通過，TypeScript typecheck 通過。
- 舊的 GitHub CLI pager 與 Terminal MCP Bash 問題屬環境問題，不列入本專案功能待辦。

- [x] 隔離測試採 mock tunnel-client 驗證 A → B → A 的 start/doctor/stop，以及跨 workspace stop 拒絕，三輪成功（2026-10-12）。
- [x] 以獨立 operation lock 串行化 shared start/stop/switch 與 set-tunnel，新增並行、過期鎖與異常釋放測試。
- [x] 真正 Tunnel ID 重連與 ChatGPT `workspace_info` A → B → A 驗收成功（2026-10-12）；已明確停止舊版 C2C profile，主用 terminal-mcp 未中斷。

- [x] 已驗證 shared runtime 啟動時，同 workspace `c2c start` 可重用、其他 workspace `c2c start` 會拒絕，且不改變目前 C2C 連線。

- [x] Managed runtime 新增 `--health.url-file` 與 loopback `/readyz` 啟動檢查；新增 ready／missing／non-loopback 單元測試。
- [x] 正常重啟真實 `c2c-shared`，動態 health URL `/readyz` 回覆 ready、ChatGPT `workspace_info` 仍正確，terminal-mcp 未中斷（2026-10-12）。
