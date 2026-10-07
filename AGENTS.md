# Paddock 64 開發規範

給參與開發的人與 AI 程式助理：專案結構、常用指令與必須遵守的慣例。系統設計見 [docs/architecture.md](docs/architecture.md)。

## 結構

| 路徑                  | 內容                                                                               |
| --------------------- | ---------------------------------------------------------------------------------- |
| `apps/api`            | NestJS REST API。`src/modules/*` 依業務分模組；`prisma/` 是 schema、遷移與示範資料 |
| `apps/web`            | 前台（Next.js 16）                                                                 |
| `apps/admin`          | 營運後台（Next.js 16）                                                             |
| `packages/api-client` | 由 OpenAPI 產生的型別與 client，**不要手改** `openapi.json`、`schema.d.ts`         |

## 常用指令

```bash
docker compose up -d                       # PostgreSQL 與 Redis
pnpm dev                                   # 前台 :3000、後台 :3001、API :4000
pnpm format:check && pnpm lint && pnpm typecheck
pnpm test                                  # 單元測試
pnpm --filter @paddock64/api test:e2e      # 端對端測試（連真的 PostgreSQL 與 Redis）
pnpm openapi                               # API 有變動時重新產生規格與 client（CI 會檢查）
pnpm db:seed                               # 示範資料（可重複執行）
```

提交前上面的檢查都要通過，並以瀏覽器實際操作一次改到的畫面。

## API

- 原始碼是 ESM：相對路徑的 import 要寫 `.js` 副檔名。
- 錯誤一律丟 `AppException`，使用 `ErrorCode` 裡的穩定代碼；前端依代碼顯示翻譯後的訊息，新增代碼要同時加到 web／admin 的 `errors` 翻譯。
- 輸入以 DTO + class-validator 驗證；日期參數（台北時間 `YYYY-MM-DD`）用 `@IsCalendarDay()`。
- 後台端點以 `@AdminAuth(Permission.X)` 宣告權限；寫入端點加 `@Audit(action, target)` 記到操作紀錄。新權限要登記在 `auth/permissions.ts`，並在後台角色頁加上說明文字。
- 金額一律是整數新台幣；時間在資料庫存 UTC，「台北的哪一天」用 `common/time/taipei.ts` 換算。
- 外部副作用（Email、發票）在同一個交易寫入待辦，由排程處理，不在交易裡直接呼叫外部服務（[ADR 0004](docs/adr/0004-transactional-outbox.md)）。
- 排程要先取得 Redis 鎖，多個執行個體同時運作時才不會重複執行。

### 資料庫遷移

```bash
cd apps/api
npx prisma format
ts=$(date -u +%Y%m%d%H%M%S); mkdir prisma/migrations/${ts}_<名稱>
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script \
  -o prisma/migrations/${ts}_<名稱>/migration.sql
# Prisma 不支援的 CHECK 約束等，直接加在 migration.sql 後面
npx prisma migrate deploy && npx prisma generate
```

不要對共用或正式資料庫執行 `prisma migrate reset`。

## 前台與後台

- 這是 Next.js 16，部分 API 與舊版不同，寫程式前先看 `node_modules/next/dist/docs/`（見各 app 的 `AGENTS.md`）。
- Server Component 用 `serverApi()` 讀資料；Server Action 用 `actionApi()`（必要時先換發權杖）。瀏覽器不直接呼叫 API（[ADR 0007](docs/adr/0007-server-side-api-calls.md)）。
- 表單用 `useFormAction`，不要直接把 `useActionState` 的 action 綁在 `<form action>`：React 19 會在動作結束後重設表單，送出失敗時使用者輸入的內容會被清掉。
- 共用的常數放在一般模組（例如 `lib/*.ts`），不要從 `'use client'` 檔案匯出給 Server Component 使用。
- `cn()` 以 tailwind-merge 合併 className，呼叫端傳入的 class 會覆蓋預設值。

## 多語系

- 前台與後台都有 `zh-TW`、`en`、`zh-CN` 三份翻譯，新增文字三份都要加。
- `zh-CN` 由繁體轉換，固定譯法：超商 → 便利店、帳號 → 账号、釋出 → 释出。
- 訊息使用 ICU 格式，字面上的大括號要跳脫，例如 `'{{name}}'`。

## 測試

- 單元測試放在原始碼旁（`*.spec.ts`），純函式（計價、狀態機、格式驗證）以單元測試為主。
- 端對端測試放在 `apps/api/test`，共用一個測試資料庫，各檔案依序執行，每個測試開始前清空資料庫。
- 修 bug 先寫出能重現的測試，再修正。

## Commit

使用 Conventional Commits，標題與內文用繁體中文，範圍標出影響的應用：

```text
feat(api): 系統設定（運費、免運門檻、付款期限）

- 條列這次的改動與理由
```

常用類型：`feat`、`fix`、`perf`、`refactor`、`docs`、`test`、`ci`、`chore`。
