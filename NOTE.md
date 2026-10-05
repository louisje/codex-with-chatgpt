# 待處理事項

- 2026-10-05：GitHub CLI 的 pager 設定嘗試執行 `cat;` 而失敗；本次以 `GH_PAGER=cat` 暫時避開，之後可檢查 pager 環境設定。

- 2026-10-05：Terminal MCP 的 shell 找不到 `pnpm`，且本機尚未安裝專案依賴；先使用 `corepack pnpm` 進行本次驗證，之後可整理開發環境的套件管理器設定。
- 2026-10-05：Terminal MCP 新建的預設 Bash 工作階段長時間未出現提示字元；改用 `/bin/sh` 可正常執行。原因尚未確認，未中斷原工作階段。
