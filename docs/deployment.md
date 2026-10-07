# 部署指南

正式環境的組成：

| 元件          | 服務    | 說明                                                         |
| ------------- | ------- | ------------------------------------------------------------ |
| 前台、後台    | Vercel  | 兩個專案，各自指向 `apps/web`、`apps/admin`                  |
| API           | Railway | 以 `apps/api/Dockerfile` 建置，部署前自動套用資料庫遷移      |
| PostgreSQL    | Neon    | 連線池網址給 API，直連網址給遷移                             |
| Redis         | Upstash | 限量發售閘門、排程鎖、結帳頻率限制                           |
| Email（選用） | Resend  | 未設定時信件只寫入紀錄（`EMAIL_PROVIDER=log`），不會真的寄出 |

四個服務都有免費或低價的方案，足夠作品集示範使用。區域建議都選新加坡（離台灣最近）。

部署順序：資料庫與 Redis → API → 匯入示範資料 → 前台與後台 → 回頭補上網址相關的設定。

## 1. 資料庫：Neon

1. 建立專案，PostgreSQL 版本選 16、區域選 AWS Asia Pacific (Singapore)。
2. 在 Connection Details 取得兩種連線網址：
   - **連線池（pooled）**：主機名稱含 `-pooler`，給 API 使用（`DATABASE_URL`）。
   - **直連（direct）**：給資料庫遷移使用（`DIRECT_DATABASE_URL`）。遷移需要 advisory lock，連線池不支援。
3. 兩個網址都要帶 `?sslmode=require`。

## 2. Redis：Upstash

1. 建立 Redis 資料庫，區域選 ap-southeast-1，開啟 TLS。
2. 複製 `rediss://default:<密碼>@<主機>.upstash.io:6379` 格式的網址（注意是 `rediss`，代表 TLS）。

## 3. API：Railway

1. 新增專案 → Deploy from GitHub repo，選這個 repository。
2. 服務設定（Settings）：
   - **Root Directory** 留空：Dockerfile 需要 monorepo 根目錄的 `pnpm-lock.yaml` 與 workspace 設定。
   - **Config-as-code** 的設定檔路徑填 `apps/api/railway.json`。裡面指定了 Dockerfile 建置、只在 API 相關檔案變動時重新部署、部署前執行 `prisma migrate deploy`、健康檢查 `/v1/health` 與失敗自動重啟。
3. Networking → Generate Domain，取得 API 的網址（例如 `https://paddock64-api.up.railway.app`）。
4. 設定環境變數（Variables）：

| 變數                  | 值                                                       |
| --------------------- | -------------------------------------------------------- |
| `NODE_ENV`            | `production`                                             |
| `DATABASE_URL`        | Neon 連線池網址                                          |
| `DIRECT_DATABASE_URL` | Neon 直連網址                                            |
| `REDIS_URL`           | Upstash 的 `rediss://` 網址                              |
| `JWT_SECRET`          | `openssl rand -base64 48` 產生的亂碼                     |
| `API_PUBLIC_URL`      | API 的網址（金流、物流回呼與圖片網址會用到）             |
| `WEB_BASE_URL`        | 前台網址（付款導回、Email 內的連結）                     |
| `CORS_ORIGINS`        | 前台與後台網址，以逗號分隔                               |
| `SWAGGER_ENABLED`     | `true`（公開 API 文件於 `/docs`）                        |
| `DEMO_MODE`           | 公開示範站設為 `true`（見[公開示範環境](#公開示範環境)） |

`PORT` 由 Railway 自動帶入。金流、物流、發票預設是模擬服務，要改用綠界見[金流、物流與電子發票](payments.md)；要真的寄信，設定 `EMAIL_PROVIDER=resend`、`RESEND_API_KEY` 與已在 Resend 驗證過網域的 `EMAIL_FROM`。完整清單見 [`apps/api/.env.example`](../apps/api/.env.example)。

部署完成後打開 `https://<API 網址>/v1/health`，看到 `"status":"ok"` 代表資料庫與 Redis 都連上了。

> 映像包含 Prisma CLI（約 600 MB），讓 Railway 在部署前直接執行遷移。如果想要更小的映像，可以改由 CI 執行遷移，並把 `prisma` 移回 devDependencies。

## 4. 匯入示範資料

示範資料（商品、會員、訂單、活動、優惠券…）以種子程式匯入，可以重複執行。在本機對正式資料庫執行一次：

```bash
cd apps/api
DATABASE_URL="<Neon 直連網址>" pnpm db:seed
```

也可以在設定好[每日重整](#公開示範環境)之後，到 GitHub Actions 手動執行「示範環境每日重整」。

## 5. 前台與後台：Vercel

從同一個 repository 建立兩個 Vercel 專案：

| 設定                         | 前台              | 後台              |
| ---------------------------- | ----------------- | ----------------- |
| Root Directory               | `apps/web`        | `apps/admin`      |
| Framework Preset             | Next.js           | Next.js           |
| `API_BASE_URL`               | API 網址          | API 網址          |
| `NEXT_PUBLIC_SITE_URL`       | 前台網址          | —                 |
| `NEXT_PUBLIC_STOREFRONT_URL` | —                 | 前台網址          |
| `NEXT_PUBLIC_API_DOCS_URL`   | `<API 網址>/docs` | `<API 網址>/docs` |

- Vercel 會在 monorepo 根目錄以 pnpm 安裝依賴（需保持 Settings → Root Directory 底下的「Include files outside the root directory」開啟，前後台要用到 `packages/api-client`）。
- 各自的 `vercel.json` 設定了 ignore 指令：只有自己、共用套件或 lockfile 有變動時才重新建置。
- `NEXT_PUBLIC_` 開頭的變數在建置時寫入，修改後要重新部署才會生效。

兩個專案部署好之後，回到 Railway 把 `WEB_BASE_URL` 與 `CORS_ORIGINS` 改成實際網址。

## 6. 自訂網域（選用）

在 Vercel 與 Railway 分別加上網域（例如 `paddock64.example`、`admin.paddock64.example`、`api.paddock64.example`），再更新所有網址相關的環境變數。前台換網域後 `sitemap.xml` 與 `robots.txt` 會自動使用新的 `NEXT_PUBLIC_SITE_URL`（重新部署後生效）。

## 公開示範環境

示範帳號的帳密公開在 README，任何人都能登入後台。為了讓示範站長期可用：

**示範帳號保護**：API 設定 `DEMO_MODE=true` 後，示範帳號（預設為 README 上的四個帳號，可用 `DEMO_ACCOUNTS` 調整）不能改密碼、停用、刪除或被停權。示範會員仍可修改個人資料，每天重整時還原。

**每日重整**：`.github/workflows/demo-refresh.yml` 每天台灣時間凌晨 3 點重新執行種子程式（`DEMO_RESET=true`），會：

- 還原示範帳號的密碼與名稱、角色權限與系統設定。
- 以當下時間重新計算發售時間：限量發售的倒數、優先購與發售行事曆永遠在未來。
- 即將開賣的商品恢復完整名額，賣完的現貨補回初始庫存（都會記錄庫存異動）。
- 重建首頁橫幅與公告、刪除訪客新增的活動、下架訪客新增的商品、停用訪客新增的品牌與分類。
- 保留訂單、會員與優惠券，讓報表持續有資料。

啟用方式（GitHub repository 的 Settings）：

1. Secrets and variables → Actions → Secrets：新增 `DEMO_DATABASE_URL`（Neon 網址）。
2. 同一頁的 Variables：新增 `DEMO_REFRESH_ENABLED`，值為 `true`。
3. Actions → 示範環境每日重整 → Run workflow，手動執行一次確認成功。

重整不會執行資料庫遷移：遷移只在 Railway 部署時執行，避免 `main` 比線上版本新時先改到正式資料庫。

## 擴展與注意事項

- **多個 API 執行個體**：排程以 Redis 鎖確保同一時間只有一個執行個體在跑；限量閘門的名額在 Redis，各執行個體共用。系統設定在每個執行個體快取 15 秒。
- **全域限流**：目前是每個執行個體各自計數（記憶體）。執行個體變多時，若需要嚴格的全站限流，改用 Redis 儲存的 throttler。
- **資料庫連線數**：每個執行個體的連線池大小是 `DATABASE_POOL_SIZE`（預設 10），執行個體數 × 連線池大小不要超過 Neon 連線池的上限。
- **反向代理**：API 設定 `trust proxy` 為 1（信任 Railway 的一層代理），操作紀錄與限流才拿得到使用者的 IP。若前面再加一層 CDN，要跟著調整。
- **商品圖片**：示範圖片由 API 以 `/static` 提供（快取 7 天）。流量變大時改放物件儲存與 CDN，商品圖片欄位本來就是網址。
- **備份**：Neon 支援時間點還原（point-in-time restore），免費方案的保留天數較短。

## 疑難排解

| 症狀                           | 檢查                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------- |
| Railway 健康檢查失敗           | `/v1/health` 的回應會指出是資料庫還是 Redis 連不上；Redis 網址要用 `rediss://`  |
| 部署前遷移失敗                 | `DIRECT_DATABASE_URL` 是否為直連網址（不含 `-pooler`）                          |
| 綠界付款後訂單沒有變成已付款   | `API_PUBLIC_URL` 是否為對外可連的 HTTPS 網址；Railway 的 API 紀錄是否有收到通知 |
| 前台或後台登入後馬上被登出     | 正式環境的 cookie 需要 HTTPS；確認網址是 `https://`                             |
| 前台的「API 文件」連到錯誤位置 | `NEXT_PUBLIC_API_DOCS_URL` 修改後要重新部署                                     |
