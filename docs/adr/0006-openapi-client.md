# ADR 0006：由 OpenAPI 規格產生前後台共用的 API client

- 狀態：採用

## 背景

前台、後台（以及未來的 App）都要呼叫同一套 API。手寫型別容易跟 API 脫節，欄位改名或新增必填欄位時，要等到執行時才發現。

## 決策

API 以 NestJS Swagger 外掛從 DTO 與註解產生 OpenAPI 規格；`packages/api-client` 以 openapi-typescript 產生型別、以 openapi-fetch 提供 client。前後台的呼叫（路徑、參數、回應）都有完整型別。CI 會重新產生規格並檢查是否與提交的版本一致。

## 考慮過的替代方案

- **tRPC**：型別共享更直接，但綁定 TypeScript，未來的 iOS／Android App 無法使用。
- **GraphQL**：查詢彈性高，但這個系統的畫面與 API 一對一的情況多，REST 加 OpenAPI 更單純，也更容易快取與除錯。

## 影響

- API 改動後執行 `pnpm openapi`，前後台的型別錯誤會立刻指出需要配合修改的地方。
- OpenAPI 規格同時是 `/docs` 的 API 文件，App 開發者可以直接使用。
