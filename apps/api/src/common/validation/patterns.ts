/** 網址代稱：小寫英數字，以連字號分隔 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MESSAGE = 'slug 只能使用小寫英數字與連字號';

/** 連結：站內路徑（/ 開頭，不可為 // 開頭的外部網址）或 http(s) 網址 */
export const LINK_PATTERN = /^(\/(?!\/)\S*|https?:\/\/\S+)$/;
export const LINK_MESSAGE = '連結需為 / 開頭的站內路徑或 https:// 網址';

/** 優惠碼：英數、底線與連字號，不分大小寫（一律存成大寫） */
export const COUPON_CODE_PATTERN = /^[A-Za-z0-9_-]{3,30}$/;
