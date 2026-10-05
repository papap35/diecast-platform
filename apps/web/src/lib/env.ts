/** 伺服器端呼叫 API 的位址（不會暴露到瀏覽器） */
export const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

/** 網站對外網址，用於付款完成後導回、SEO 等 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
