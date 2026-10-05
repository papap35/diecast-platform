/**
 * 伺服器元件取得「這次請求」的時間。
 * 每次請求只渲染一次，傳給倒數元件作為 hydration 的起始值，避免伺服器與瀏覽器的初始畫面不一致。
 */
export function requestTime(): number {
  return Date.now();
}
