import { createHash, randomBytes, randomInt } from 'node:crypto';

/** 產生不透明的隨機權杖（refresh token 等），回傳 base64url 字串 */
export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** 權杖只存雜湊值；資料庫外洩也無法直接拿來登入 */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const ALPHANUMERIC = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/** 不含易混淆字元（I、O）的大寫英數亂碼，用於訂單編號、交易編號 */
export function randomCode(length: number): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHANUMERIC[bytes[i]! % ALPHANUMERIC.length];
  }
  return out;
}

/** 指定長度的隨機數字字串（模擬物流單號、發票號碼等） */
export function randomDigits(length: number): string {
  return Array.from({ length }, () => randomInt(10)).join('');
}
