import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { API_BASE_URL } from './lib/env';
import { isExpiringSoon } from './lib/jwt';

const ACCESS_COOKIE = 'p64_at';
const REFRESH_COOKIE = 'p64_rt';

const intl = createMiddleware(routing);

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

/**
 * 頁面請求時，若 access token 快過期就用 refresh token 換發：
 * 新 token 同時寫入「這次請求」的 cookie（讓伺服器渲染立即使用）與回應的 Set-Cookie（給瀏覽器）。
 * 回傳 null 表示不需要處理；'clear' 表示 refresh token 已失效，要清掉登入狀態。
 */
async function refreshIfNeeded(request: NextRequest): Promise<TokenPair | 'clear' | null> {
  if (request.method !== 'GET') return null;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refresh) return null;
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  if (access && !isExpiringSoon(access)) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
      cache: 'no-store',
    });
    if (res.ok) return (await res.json()) as TokenPair;
    // 401/403：refresh token 失效或帳號停用；其他錯誤（API 暫時不可用）不動 cookie
    return res.status === 401 || res.status === 403 ? 'clear' : null;
  } catch {
    return null;
  }
}

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const tokens = await refreshIfNeeded(request);

  let forwarded = request;
  if (tokens && tokens !== 'clear') {
    const jar = new Map(request.cookies.getAll().map(({ name, value }) => [name, value]));
    jar.set(ACCESS_COOKIE, tokens.accessToken);
    jar.set(REFRESH_COOKIE, tokens.refreshToken);
    const headers = new Headers(request.headers);
    headers.set('cookie', [...jar].map(([name, value]) => `${name}=${value}`).join('; '));
    forwarded = new NextRequest(request.url, { headers, method: request.method });
  } else if (tokens === 'clear') {
    const headers = new Headers(request.headers);
    headers.set(
      'cookie',
      request.cookies
        .getAll()
        .filter(({ name }) => name !== ACCESS_COOKIE && name !== REFRESH_COOKIE)
        .map(({ name, value }) => `${name}=${value}`)
        .join('; '),
    );
    forwarded = new NextRequest(request.url, { headers, method: request.method });
  }

  const response = intl(forwarded);

  if (tokens === 'clear') {
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
  } else if (tokens) {
    response.cookies.set(
      ACCESS_COOKIE,
      tokens.accessToken,
      cookieOptions(tokens.accessTokenExpiresIn),
    );
    response.cookies.set(
      REFRESH_COOKIE,
      tokens.refreshToken,
      cookieOptions((new Date(tokens.refreshTokenExpiresAt).getTime() - Date.now()) / 1000),
    );
  }
  return response;
}

export const config = {
  // 排除 API 路由、Next 內部檔案與靜態資源
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
