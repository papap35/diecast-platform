# 金流、物流與電子發票

金流、物流、電子發票三種第三方服務，在 API 裡都是「介面 + 多個實作」。預設使用內建的模擬服務，不需要任何帳號就能完整走過下單、付款、出貨、開發票、退款；正式串接時改用綠界（ECPay）。設計理由見 [ADR 0005](adr/0005-integration-providers.md)。

| 服務     | 環境變數             | `mock`（預設）                               | `ecpay`                                                |
| -------- | -------------------- | -------------------------------------------- | ------------------------------------------------------ |
| 金流     | `PAYMENT_PROVIDER`   | 內建模擬付款頁，可選擇付款成功或失敗         | 綠界全方位金流（AIO），信用卡付款                      |
| 物流     | `LOGISTICS_PROVIDER` | 內建模擬電子地圖與物流單，後台可模擬配送進度 | C2C 店到店（7-ELEVEN、全家、萊爾富、OK）與宅配（黑貓） |
| 電子發票 | `INVOICE_PROVIDER`   | 產生模擬的發票號碼與隨機碼                   | B2C 電子發票：開立、作廢、折讓                         |

三種服務可以分別切換，例如只把金流換成綠界、物流與發票維持模擬。

## 模擬服務

- **付款**：結帳後按「前往付款」，會開啟 API 提供的模擬付款頁，選擇「模擬付款成功」或「模擬付款失敗」後導回訂單頁。付款失敗可以重新付款；逾期未付款會由排程自動取消。
- **選店**：結帳選超商取貨時按「選擇門市」，開啟模擬電子地圖，選好門市後回到結帳頁，已填寫的資料會保留。
- **出貨**：後台訂單頁按「建立物流單」產生模擬的寄貨編號；「模擬配送進度」可以一步步推進到已到店、已取件，訂單會跟著轉為已完成，商品停進會員的車庫。
- **發票**：付款完成後自動開立模擬發票；退款時自動作廢，跨期退貨改開折讓單。

模擬服務走的是跟綠界相同的流程與資料（付款嘗試、伺服器通知、物流狀態代碼、發票狀態），切換實作不需要改動訂單流程。

## 綠界測試環境

綠界公開了測試用的特店資料，不需要申請帳號即可串接測試環境（`ECPAY_ENV=stage`）：

| 服務         | MerchantID | HashKey            | HashIV             |
| ------------ | ---------- | ------------------ | ------------------ |
| 全方位金流   | `2000132`  | `5294y06JbISpM5x9` | `v77hoKGq4kWxNNIS` |
| C2C 物流     | `2000933`  | `XBERn1YOvpM9nfZc` | `h1ONHk4P4yqbl5LK` |
| B2C 電子發票 | `2000132`  | `ejCk326UnaZWKisg` | `q9jcZX8Ib9LM8wYk` |

以上為撰寫時綠界文件公告的值，若無法使用請以[綠界開發者文件](https://developers.ecpay.com.tw/)為準。對應的環境變數：

```bash
PAYMENT_PROVIDER=ecpay
ECPAY_ENV=stage
ECPAY_MERCHANT_ID=2000132
ECPAY_HASH_KEY=5294y06JbISpM5x9
ECPAY_HASH_IV=v77hoKGq4kWxNNIS

LOGISTICS_PROVIDER=ecpay
ECPAY_LOGISTICS_MERCHANT_ID=2000933
ECPAY_LOGISTICS_HASH_KEY=XBERn1YOvpM9nfZc
ECPAY_LOGISTICS_HASH_IV=h1ONHk4P4yqbl5LK

INVOICE_PROVIDER=ecpay
ECPAY_INVOICE_MERCHANT_ID=2000132
ECPAY_INVOICE_HASH_KEY=ejCk326UnaZWKisg
ECPAY_INVOICE_HASH_IV=q9jcZX8Ib9LM8wYk
```

測試環境的信用卡付款使用綠界公告的測試卡號（撰寫時為 `4311-9522-2222-2222`，安全碼 `222`，有效期限填任何未來的月份），之後依畫面完成 3D 驗證。

### 回呼網址

綠界以「伺服器對伺服器」的方式通知付款與物流結果，所以 API 必須有對外可連的 HTTPS 網址，並設定在 `API_PUBLIC_URL`。API 會自動帶出這些網址：

| 用途                           | 路徑                                 |
| ------------------------------ | ------------------------------------ |
| 付款結果通知（ReturnURL）      | `POST /v1/payments/ecpay/notify`     |
| 付款完成導回（OrderResultURL） | `POST /v1/payments/ecpay/return`     |
| 電子地圖選店結果               | `POST /v1/logistics/ecpay/map-reply` |
| 物流狀態通知（ServerReplyURL） | `POST /v1/logistics/ecpay/notify`    |

在本機測試綠界時，需要用 Cloudflare Tunnel、ngrok 之類的工具把本機的 API 開到公開網址，再把 `API_PUBLIC_URL` 設成那個網址。

### 安全與一致性

- 每一則通知都先驗證 CheckMacValue（SHA-256），驗證失敗回錯誤，不會更新任何資料。
- 付款通知以「訂單仍是待付款」為條件更新訂單，綠界重送通知不會重複入帳；訂單已取消後才收到的付款會記錄成「延遲付款（需退款）」，交給後台處理。
- 每次付款嘗試都有不同的 `MerchantTradeNo`（綠界限 20 碼英數），付款失敗重新付款不會撞號。
- 電子發票的開立與作廢會自動重試，超過上限在後台標示需要人工處理，可以手動重試；物流單建立失敗時，可以在後台重新建立。

## 正式上線

正式環境需要向綠界申請特店帳號，取得正式的 MerchantID、HashKey、HashIV，並把 `ECPAY_ENV` 改為 `production`。HashKey 與 HashIV 是機密，只放在部署平台的環境變數，不要提交到版本控制。
