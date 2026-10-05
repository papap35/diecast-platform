import 'server-only';
import type { Schemas } from '@paddock64/api-client';
import { cookies } from 'next/headers';
import { API_BASE_URL } from './env';
import { isExpiringSoon } from './jwt';

export const ACCESS_COOKIE = 'p64_at';
export const REFRESH_COOKIE = 'p64_rt';

type TokenPair = Schemas['TokenPairDto'];

export function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.max(0, Math.floor(maxAgeSeconds)),
  };
}

export function refreshMaxAge(tokens: TokenPair): number {
  return (new Date(tokens.refreshTokenExpiresAt).getTime() - Date.now()) / 1000;
}

/** 登入成功：權杖只存在 httpOnly cookie，前端 JavaScript 讀不到 */
export async function setSession(tokens: TokenPair): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, tokens.accessToken, cookieOptions(tokens.accessTokenExpiresIn));
  store.set(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(refreshMaxAge(tokens)));
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function hasSession(): Promise<boolean> {
  const store = await cookies();
  return store.has(ACCESS_COOKIE) || store.has(REFRESH_COOKIE);
}

export async function readAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function refreshTokens(refreshToken: string): Promise<TokenPair | null> {
  const res = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });
  return res.ok ? ((await res.json()) as TokenPair) : null;
}

/**
 * Server Action 用：取得有效的 access token，快過期時自動以 refresh token 換發並更新 cookie。
 * （頁面請求的刷新在 proxy.ts 處理）
 */
export async function ensureAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;
  if (access && !isExpiringSoon(access)) return access;
  const refresh = store.get(REFRESH_COOKIE)?.value;
  if (!refresh) return undefined;
  const tokens = await refreshTokens(refresh);
  if (!tokens) {
    await clearSession();
    return undefined;
  }
  await setSession(tokens);
  return tokens.accessToken;
}
