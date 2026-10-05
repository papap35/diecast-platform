import { type NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from './lib/env';
import { isExpiringSoon } from './lib/jwt';

const ACCESS_COOKIE = 'p64a_at';
const REFRESH_COOKIE = 'p64a_rt';

interface TokenPair {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.max(0, Math.floor(maxAgeSeconds)),
  };
}

async function refresh(refreshToken: string): Promise<TokenPair | 'invalid' | 'error'> {
  try {
    const res = await fetch(`${API_BASE_URL}/v1/admin/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    if (res.ok) return (await res.json()) as TokenPair;
    return res.status === 401 || res.status === 403 ? 'invalid' : 'error';
  } catch {
    return 'error';
  }
}

function toLogin(request: NextRequest): NextResponse {
  const url = new URL('/login', request.url);
  const next = request.nextUrl.pathname + request.nextUrl.search;
  if (next !== '/') url.searchParams.set('next', next);
  const response = NextResponse.redirect(url);
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}

/**
 * 後台全站需要登入：
 * - 沒有登入 → 導向 /login
 * - access token 快過期 → 用 refresh token 換發，新權杖同時寫入本次請求與回應
 */
export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const isLogin = request.nextUrl.pathname === '/login';
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (isLogin) {
    return refreshToken ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next();
  }
  if (!refreshToken) return toLogin(request);
  if (access && !isExpiringSoon(access)) return NextResponse.next();
  // Server Action（POST）自行刷新權杖，這裡只處理頁面請求
  if (request.method !== 'GET') return NextResponse.next();

  const result = await refresh(refreshToken);
  if (result === 'invalid') return toLogin(request);
  if (result === 'error') return NextResponse.next();

  const jar = new Map(request.cookies.getAll().map(({ name, value }) => [name, value]));
  jar.set(ACCESS_COOKIE, result.accessToken);
  jar.set(REFRESH_COOKIE, result.refreshToken);
  const headers = new Headers(request.headers);
  headers.set('cookie', [...jar].map(([name, value]) => `${name}=${value}`).join('; '));

  const response = NextResponse.next({ request: { headers } });
  response.cookies.set(
    ACCESS_COOKIE,
    result.accessToken,
    cookieOptions(result.accessTokenExpiresIn),
  );
  response.cookies.set(
    REFRESH_COOKIE,
    result.refreshToken,
    cookieOptions((new Date(result.refreshTokenExpiresAt).getTime() - Date.now()) / 1000),
  );
  return response;
}

export const config = {
  matcher: '/((?!api|_next|.*\\..*).*)',
};
