/**
 * 圖片網址：上傳到物件儲存（S3/R2）的圖片存完整網址；
 * 內建示範圖片存相對路徑（/static/...），輸出時補上 API 對外網址，讓 Web、Admin、App 都能直接載入。
 */
export function toPublicUrl(url: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${baseUrl.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
}
