/** 只解析 JWT 的 payload 取得到期時間（不驗簽，驗證交給 API） */
export function jwtExpiresAt(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number };
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** 60 秒內到期就視為需要刷新，避免請求途中過期 */
export function isExpiringSoon(token: string, now = Date.now()): boolean {
  const exp = jwtExpiresAt(token);
  return exp === null || exp - now < 60_000;
}
