export const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';
/** 前台網址（後台的「在前台查看」連結） */
export const STOREFRONT_URL = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? 'http://localhost:3000';
/** 瀏覽器開啟的 API 文件網址（API_BASE_URL 可能是內部網址，瀏覽器連不到） */
export const API_DOCS_URL = process.env.NEXT_PUBLIC_API_DOCS_URL ?? `${API_BASE_URL}/docs`;
