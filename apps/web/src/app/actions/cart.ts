'use server';

import type { Schemas } from '@paddock64/api-client';
import { refresh } from 'next/cache';
import { type ActionResult, toActionError, UNAUTHORIZED } from '@/lib/action-result';
import { actionApi } from '@/lib/api';
import { ensureAccessToken } from '@/lib/session';

type Cart = Schemas['CartDto'];
type Locale = 'zh-TW' | 'en' | 'zh-CN';

export async function setCartItemAction(
  productId: string,
  quantity: number,
  locale: Locale,
): Promise<ActionResult<Cart>> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi(locale);
  const { data, error, response } = await api.PUT('/v1/cart/items/{productId}', {
    params: { path: { productId }, query: { locale } },
    body: { quantity },
  });
  if (!response.ok || !data) return { ok: false, error: toActionError(error, response.status) };
  refresh();
  return { ok: true, data };
}

export async function removeCartItemAction(
  productId: string,
  locale: Locale,
): Promise<ActionResult<Cart>> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi(locale);
  const { data, error, response } = await api.DELETE('/v1/cart/items/{productId}', {
    params: { path: { productId }, query: { locale } },
  });
  if (!response.ok || !data) return { ok: false, error: toActionError(error, response.status) };
  refresh();
  return { ok: true, data };
}
