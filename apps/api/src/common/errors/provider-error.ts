/** 第三方服務（綠界物流、電子發票）回傳錯誤或無法連線；訊息會記錄在訂單事件並顯示給後台人員 */
export class ProviderError extends Error {}
