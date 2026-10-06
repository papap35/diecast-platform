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

/**
 * RFC 9562 UUIDv7（前 48 位元是毫秒時間戳，依時間排序）。
 * 與 Prisma 的 @default(uuid(7)) 同格式，給原生 SQL 寫入時自行帶 id 用。
 */
export function uuidv7(now = Date.now()): string {
  const bytes = randomBytes(16);
  bytes.writeUIntBE(now, 0, 6);
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
