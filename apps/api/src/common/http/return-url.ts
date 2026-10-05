import type { AppConfig } from '../../config/config.module.js';

/** 前台（Web、Admin）的網域清單：導回網址的白名單，也是內建模擬頁 CSP 允許送出表單的目標 */
export function frontendOrigins(
  config: Pick<AppConfig, 'WEB_BASE_URL' | 'CORS_ORIGINS'>,
): string[] {
  return [
    ...new Set([config.WEB_BASE_URL, ...config.CORS_ORIGINS].map((url) => new URL(url).origin)),
  ];
}

/**
 * 第三方流程（金流付款、物流選店）完成後導回的網址只接受自家網域或 App 的 deep link，
 * 避免被利用成開放式重新導向（open redirect）。不符合時改用 fallback。
 */
export function resolveReturnUrl(
  requested: string | undefined,
  fallback: string,
  allowedOrigins: string[],
): string {
  if (!requested) return fallback;
  if (requested.startsWith('paddock64://')) return requested;
  try {
    return allowedOrigins.includes(new URL(requested).origin) ? requested : fallback;
  } catch {
    return fallback;
  }
}

/** 在網址後附加查詢參數（保留原有參數） */
export function withQuery(url: string, params: Record<string, string>): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${new URLSearchParams(params).toString()}`;
}
