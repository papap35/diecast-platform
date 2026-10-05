import { randomCode } from '../../common/security/random.js';

/** 以台灣時間取得 YYMMDD */
export function taipeiDateStamp(date: Date = new Date()): string {
  const taipei = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const yy = String(taipei.getUTCFullYear()).slice(2);
  const mm = String(taipei.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(taipei.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/** 訂單編號：P64 + 台灣日期 + 5 碼亂碼，例如 P64261005K7Q2M（客服好念、不可猜測） */
export function generateOrderNo(date: Date = new Date()): string {
  return `P64${taipeiDateStamp(date)}${randomCode(5)}`;
}

/** 金流交易編號：綠界限 20 碼英數字，每次付款嘗試都不同 */
export function generateMerchantTradeNo(date: Date = new Date()): string {
  return `P${taipeiDateStamp(date)}${randomCode(12)}`;
}
