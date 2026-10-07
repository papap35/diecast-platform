# ADR 0001：以 pnpm workspace 的單一 repository 管理

- 狀態：採用

## 背景

系統有三個應用（前台、後台、API）與一個共用的 API client。API 的變動經常同時影響前後台：新增欄位、調整錯誤代碼、改變回應格式。

## 決策

使用單一 repository，以 pnpm workspace 管理 `apps/*` 與 `packages/*`。根目錄的指令（`pnpm lint`、`pnpm typecheck`、`pnpm test`）一次檢查所有應用；CI 也只有一條流程。

## 考慮過的替代方案

- **三個獨立的 repository**：權限與部署可以分開，但一個功能要開三個 PR、版本要手動對齊，共用 client 需要發佈到套件庫。
- **Turborepo／Nx**：有任務快取與相依圖，但目前只有四個套件，pnpm 的 `--filter` 已經足夠，少一層工具。

## 影響

- API 改動與前後台的配合修改可以在同一個 commit 完成，型別檢查立即發現不相容。
- 部署平台要支援 monorepo：Vercel 以 Root Directory 指定應用，Railway 以 Dockerfile 從根目錄建置（見 [ADR 0008](0008-deployment-platforms.md)）。
