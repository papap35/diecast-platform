import 'server-only';
import type { Schemas } from '@paddock64/api-client';
import { cookies } from 'next/headers';
import { API_BASE_URL } from './env';
import { isExpiringSoon } from './jwt';

export const ACCESS_COOKIE = 'p64a_at';
export const REFRESH_COOKIE = 'p64a_rt';

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

export async function setSession(tokens: TokenPair): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, tokens.accessToken, cookieOptions(tokens.accessTokenExpiresIn));
  store.set(
    REFRESH_COOKIE,
    tokens.refreshToken,
    cookieOptions((new Date(tokens.refreshTokenExpiresAt).getTime() - Date.now()) / 1000),
  );
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function readAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function ensureAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;
  if (access && !isExpiringSoon(access)) return access;
  const refresh = store.get(REFRESH_COOKIE)?.value;
  if (!refresh) return undefined;
  const res = await fetch(`${API_BASE_URL}/v1/admin/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
    cache: 'no-store',
  });
  if (!res.ok) {
    await clearSession();
    return undefined;
  }
  const tokens = (await res.json()) as TokenPair;
  await setSession(tokens);
  return tokens.accessToken;
}
