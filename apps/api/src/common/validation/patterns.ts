/** 網址代稱：小寫英數字，以連字號分隔 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MESSAGE = 'slug 只能使用小寫英數字與連字號';

/** 連結：站內路徑（/ 開頭，不可為 // 開頭的外部網址）或 http(s) 網址 */
export const LINK_PATTERN = /^(\/(?!\/)\S*|https?:\/\/\S+)$/;
export const LINK_MESSAGE = '連結需為 / 開頭的站內路徑或 https:// 網址';
