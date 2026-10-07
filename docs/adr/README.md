# 架構決策紀錄（ADR）

記錄重要的技術選擇：當時的背景、做了什麼決定、考慮過哪些替代方案，以及帶來的影響。

| 編號                                     | 決策                                         |
| ---------------------------------------- | -------------------------------------------- |
| [0001](0001-monorepo.md)                 | 以 pnpm workspace 的單一 repository 管理     |
| [0002](0002-api-stack.md)                | API 使用 NestJS、Prisma 與 PostgreSQL        |
| [0003](0003-limited-drop-concurrency.md) | 限量發售的併發控制：Redis 閘門加條件式扣庫存 |
| [0004](0004-transactional-outbox.md)     | 副作用以同一交易寫入待辦，由排程處理         |
| [0005](0005-integration-providers.md)    | 金流、物流、電子發票介面化，內建模擬實作     |
| [0006](0006-openapi-client.md)           | 由 OpenAPI 規格產生前後台共用的 API client   |
| [0007](0007-server-side-api-calls.md)    | 前台與後台只在伺服器端呼叫 API               |
| [0008](0008-deployment-platforms.md)     | 部署在 Vercel、Railway、Neon、Upstash        |
