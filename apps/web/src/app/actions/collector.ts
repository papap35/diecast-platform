'use server';

import type { Schemas } from '@paddock64/api-client';
import { refresh } from 'next/cache';
import type { AppLocale } from '@/i18n/routing';
import { type ActionResult, toActionError, UNAUTHORIZED } from '@/lib/action-result';
import { actionApi } from '@/lib/api';
import { ensureAccessToken } from '@/lib/session';

type GarageItemInput = Schemas['CreateGarageItemDto'];
type GarageItemUpdate = Schemas['UpdateGarageItemDto'];

async function authed() {
  return (await ensureAccessToken()) ? actionApi() : null;
}

/** 加入或移除願望清單 */
export async function setWishlistAction(productId: string, on: boolean): Promise<ActionResult> {
  const api = await authed();
  if (!api) return { ok: false, error: UNAUTHORIZED };
  const params = { params: { path: { productId } } };
  const { error, response } = on
    ? await api.PUT('/v1/me/wishlist/{productId}', params)
    : await api.DELETE('/v1/me/wishlist/{productId}', params);
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  return { ok: true, data: undefined };
}

/** 設定或取消發售提醒 */
export async function setReminderAction(productId: string, on: boolean): Promise<ActionResult> {
  const api = await authed();
  if (!api) return { ok: false, error: UNAUTHORIZED };
  const params = { params: { path: { productId } } };
  const { error, response } = on
    ? await api.PUT('/v1/me/reminders/{productId}', params)
    : await api.DELETE('/v1/me/reminders/{productId}', params);
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  return { ok: true, data: undefined };
}

/** 標示通知為已讀（不帶 ids 表示全部） */
export async function markNotificationsReadAction(ids?: string[]): Promise<ActionResult> {
  const api = await authed();
  if (!api) return { ok: false, error: UNAUTHORIZED };
  const { error, response } = await api.POST('/v1/me/notifications/read', {
    body: ids ? { ids } : {},
  });
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  refresh();
  return { ok: true, data: undefined };
}

export async function addGarageItemAction(
  input: GarageItemInput,
  locale: AppLocale,
): Promise<ActionResult> {
  const api = await authed();
  if (!api) return { ok: false, error: UNAUTHORIZED };
  const { error, response } = await api.POST('/v1/me/garage', {
    params: { query: { locale } },
    body: input,
  });
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  refresh();
  return { ok: true, data: undefined };
}

export async function updateGarageItemAction(
  id: string,
  input: GarageItemUpdate,
  locale: AppLocale,
): Promise<ActionResult> {
  const api = await authed();
  if (!api) return { ok: false, error: UNAUTHORIZED };
  const { error, response } = await api.PATCH('/v1/me/garage/{id}', {
    params: { path: { id }, query: { locale } },
    body: input,
  });
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  refresh();
  return { ok: true, data: undefined };
}

export async function removeGarageItemAction(id: string): Promise<ActionResult> {
  const api = await authed();
  if (!api) return { ok: false, error: UNAUTHORIZED };
  const { error, response } = await api.DELETE('/v1/me/garage/{id}', {
    params: { path: { id } },
  });
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  refresh();
  return { ok: true, data: undefined };
}

export async function updateGarageSettingsAction(
  settings: Schemas['UpdateGarageSettingsDto'],
): Promise<ActionResult<Schemas['GarageSettingsDto']>> {
  const api = await authed();
  if (!api) return { ok: false, error: UNAUTHORIZED };
  const { data, error, response } = await api.PUT('/v1/me/garage/settings', { body: settings });
  if (!response.ok || !data) return { ok: false, error: toActionError(error, response.status) };
  refresh();
  return { ok: true, data };
}
