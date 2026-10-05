import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * 綠界的 URL 編碼規則（與官方 SDK 相同）：
 * encodeURIComponent 後轉小寫，再補上 .NET UrlEncode 的差異（' → %27、~ → %7e、空白 → +）。
 */
export function ecpayUrlEncode(raw: string): string {
  return encodeURIComponent(raw)
    .toLowerCase()
    .replace(/'/g, '%27')
    .replace(/~/g, '%7e')
    .replace(/%20/g, '+');
}

/**
 * 綠界檢查碼 CheckMacValue：
 * 1. 參數依名稱（不分大小寫）排序，以 & 串接
 * 2. 前面加 HashKey=…&，後面加 &HashIV=…
 * 3. 依綠界規則 URL 編碼並轉小寫
 * 4. SHA256（物流 API 為 MD5）後轉大寫
 */
export function generateCheckMacValue(
  params: Record<string, string | number>,
  hashKey: string,
  hashIV: string,
  algorithm: 'sha256' | 'md5' = 'sha256',
): string {
  const query = Object.keys(params)
    .filter((key) => key !== 'CheckMacValue')
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  const raw = ecpayUrlEncode(`HashKey=${hashKey}&${query}&HashIV=${hashIV}`);
  return createHash(algorithm).update(raw).digest('hex').toUpperCase();
}

/** 驗證綠界回傳資料的檢查碼（固定時間比較，避免時序攻擊） */
export function verifyCheckMacValue(
  params: Record<string, string>,
  hashKey: string,
  hashIV: string,
  algorithm: 'sha256' | 'md5' = 'sha256',
): boolean {
  const received = params.CheckMacValue;
  if (!received) return false;
  const expected = generateCheckMacValue(params, hashKey, hashIV, algorithm);
  const a = Buffer.from(expected);
  const b = Buffer.from(received.toUpperCase());
  return a.length === b.length && timingSafeEqual(a, b);
}
