/** 內建 HTML 頁（模擬金流、模擬選店）共用的工具 */

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

/**
 * 模擬頁的 CSP：只允許內嵌樣式，表單只能送回 API 本身。
 * 表單送出後會轉址回前台，瀏覽器對轉址也套用 form-action，因此要列出前台網域。
 */
export function mockPageCsp(redirectOrigins: string[]): string {
  return `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${redirectOrigins.join(' ')} paddock64:; base-uri 'none'; frame-ancestors 'none'`;
}
