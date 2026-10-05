/** 綠界共用格式工具 */

/** 綠界要求的時間格式：yyyy/MM/dd HH:mm:ss（台灣時間） */
export function ecpayDateTime(date: Date): string {
  const taipei = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${taipei.getUTCFullYear()}/${pad(taipei.getUTCMonth() + 1)}/${pad(taipei.getUTCDate())} ${pad(
    taipei.getUTCHours(),
  )}:${pad(taipei.getUTCMinutes())}:${pad(taipei.getUTCSeconds())}`;
}

/** 電子發票 API 的日期格式：yyyy-MM-dd（台灣時間） */
export function ecpayDate(date: Date): string {
  return ecpayDateTime(date).slice(0, 10).replace(/\//g, '-');
}

/** 解析綠界回傳的台灣時間（yyyy/MM/dd HH:mm:ss、yyyy-MM-dd HH:mm:ss，日期與時間間可能是 T 或 +） */
export function parseEcpayDateTime(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})[/-](\d{2})[/-](\d{2})[ T+](\d{2}):(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const [, y, m, d, hh, mm, ss] = match;
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}+08:00`);
}

/**
 * 物流收寄件人姓名規則：中文 2–5 字或英文 4–10 字，不可有數字與符號。
 * 不符合時盡量修正（去除符號、截斷），仍不合格交由綠界回傳錯誤。
 */
export function ecpayPersonName(name: string): string {
  const cleaned = name.replace(/[^\p{L}]/gu, '');
  return /\p{Script=Han}/u.test(cleaned) ? cleaned.slice(0, 5) : cleaned.slice(0, 10);
}

/** 商品名稱不可包含綠界禁用的特殊符號，長度上限 50 */
export function ecpayGoodsName(name: string): string {
  return name.replace(/[\^'`!@#%&*+\\"<>|_[\]]/g, '').slice(0, 50);
}
