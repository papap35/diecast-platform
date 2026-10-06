import type { ApiErrorBody } from '@paddock64/api-client';
import type { NextRequest } from 'next/server';
import { API_BASE_URL } from '@/lib/env';
import { ensureAccessToken } from '@/lib/session';

const FILES = { orders: 'orders.csv', products: 'products.csv' } as const;
const FORWARDED = ['from', 'to', 'status'];

/**
 * CSV 下載：瀏覽器沒有 API 的 access token（存在 httpOnly cookie），
 * 由後台伺服器帶權杖向 API 取檔，再把串流原封不動轉給瀏覽器。
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<'/reports/export/[kind]'>,
) {
  const { kind } = await params;
  const file = FILES[kind as keyof typeof FILES];
  if (!file) return new Response('Not found', { status: 404 });

  const back = new URL('/reports', request.url);
  const query = new URLSearchParams();
  for (const key of FORWARDED) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) {
      query.set(key, value);
      back.searchParams.set(key, value);
    }
  }

  const token = await ensureAccessToken();
  if (!token) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', `${back.pathname}${back.search}`);
    return Response.redirect(login, 303);
  }

  const upstream = await fetch(`${API_BASE_URL}/v1/admin/reports/${file}?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!upstream.ok || !upstream.body) {
    const body = (await upstream.json().catch(() => null)) as Partial<ApiErrorBody> | null;
    back.searchParams.set('exportError', body?.error?.code ?? 'INTERNAL_ERROR');
    return Response.redirect(back, 303);
  }
  return new Response(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'text/csv; charset=utf-8',
      'Content-Disposition': upstream.headers.get('content-disposition') ?? 'attachment',
      'Cache-Control': 'no-store',
    },
  });
}
