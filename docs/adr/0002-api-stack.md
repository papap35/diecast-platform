# ADR 0002：API 使用 NestJS、Prisma 與 PostgreSQL

- 狀態：採用

## 背景

API 要同時服務 Web 前台、營運後台與未來的手機 App，業務規則多（訂單狀態機、優惠券、會員等級、發票），而且有大量需要交易一致性的操作（扣庫存、付款入帳、優惠券使用次數）。

## 決策

- **NestJS**：模組化與依賴注入讓二十多個業務模組維持清楚的邊界；guard、interceptor、pipe 統一處理權限、操作紀錄與驗證；搭配 Swagger 外掛直接從 DTO 產生 OpenAPI 文件。
- **PostgreSQL**：交易、條件式更新、CHECK 約束、advisory lock 與 `pg_stat_activity` 都是這個系統實際用到的功能。
- **Prisma 7**（`prisma-client` 產生器加 `@prisma/adapter-pg`）：型別安全的查詢與遷移管理；不需要 Rust 查詢引擎，部署較單純。效能關鍵的地方（扣庫存、報表）用 `$queryRaw` 寫 SQL。

## 考慮過的替代方案

- **Express／Fastify 自行組合**：彈性高，但權限、驗證、文件都要自己串，模組一多容易失去一致性。
- **Drizzle／Kysely**：更貼近 SQL，但遷移與型別產生的生態不如 Prisma 完整；需要手寫 SQL 的地方 Prisma 也能做到。
- **MongoDB**：訂單、庫存、優惠券之間的一致性需求高，關聯式資料庫較合適。

## 影響

- 遷移以 `prisma migrate` 管理，CHECK 約束等 Prisma 不支援的語法直接寫在遷移的 SQL 裡。
- 報表與扣庫存使用原生 SQL，需要以端對端測試保護（測試連真的 PostgreSQL）。
