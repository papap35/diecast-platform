# ADR 0007：前台與後台只在伺服器端呼叫 API

- 狀態：採用

## 背景

會員與管理員的權杖如果放在瀏覽器可讀的地方（localStorage 或一般 cookie），一旦有 XSS 就可能外洩。另外，前台需要伺服器端渲染（SEO、首次載入速度）。

## 決策

Next.js 的 Server Component 讀資料、Server Action 寫資料，都在伺服器端以 `Authorization: Bearer` 呼叫 API。access token 與 refresh token 存在 httpOnly、SameSite=Lax 的 cookie，正式環境加上 Secure。權杖快過期時，頁面請求由 `proxy.ts` 先換發，Server Action 在送出前自己檢查。

## 考慮過的替代方案

- **瀏覽器直接呼叫 API**：少一層轉送，但權杖要讓 JavaScript 讀得到，也需要處理跨網域 CORS 與 CSRF。
- **Next.js 當作 API 的反向代理（BFF 轉送所有請求）**：可行，但多數頁面本來就在伺服器端渲染，直接在伺服器呼叫更單純。

## 影響

- 瀏覽器的 JavaScript 拿不到權杖；API 只需要信任 Next.js 伺服器送來的 Bearer token。
- 少數例外直接由瀏覽器連到 API：商品圖片、模擬付款與選店頁。綠界的回呼則是綠界的伺服器直接通知 API；後台的 CSV 下載仍經過後台伺服器轉送。
- 表單送出失敗時保留輸入內容需要額外處理（React 19 的 form action 會重設表單），已封裝成 `useFormAction`。
