import { createHmac, timingSafeEqual } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function signature(memberId: string, secret: string): string {
  return createHmac('sha256', secret).update(`unsubscribe:${memberId}`).digest('base64url');
}

/**
 * 退訂連結的權杖：會員 id 加上 HMAC 簽章（不需要登入、不會過期，也無法偽造別人的）。
 * 簽章內容帶用途前綴，與登入用的 JWT 共用密鑰也不會互相冒用。
 */
export function unsubscribeToken(memberId: string, secret: string): string {
  return `${memberId}.${signature(memberId, secret)}`;
}

/** 驗證退訂權杖，成功回傳會員 id */
export function verifyUnsubscribeToken(token: string, secret: string): string | null {
  const [memberId, sig, ...rest] = token.split('.');
  if (!memberId || !sig || rest.length > 0 || !UUID.test(memberId)) return null;
  const expected = Buffer.from(signature(memberId, secret));
  const actual = Buffer.from(sig);
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? memberId : null;
}

/** RFC 8058 一鍵退訂：信箱服務（Gmail、Yahoo…）會直接 POST 這個網址 */
export function listUnsubscribeHeaders(url: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
