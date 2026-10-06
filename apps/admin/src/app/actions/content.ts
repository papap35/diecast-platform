'use server';

import type { Schemas } from '@paddock64/api-client';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  type ActionError,
  type ActionResult,
  toActionError,
  UNAUTHORIZED,
} from '@/lib/action-result';
import { actionApi } from '@/lib/api';
import { fromTaipeiInput } from '@/lib/format';
import { ensureAccessToken } from '@/lib/session';

export interface ContentFormState {
  error?: ActionError;
  saved?: boolean;
}

const LOCALES = ['zh-TW', 'en', 'zh-CN'] as const;

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
};
const optional = (formData: FormData, key: string) => text(formData, key) || null;

type CreateEvent = Schemas['CreateEventDto'];

/** 活動表單 → API 格式；非繁中的語系沒有標題就不送出（前台回退繁中） */
function eventBody(formData: FormData): CreateEvent {
  const translations = LOCALES.flatMap((locale) => {
    const title = text(formData, `title.${locale}`);
    if (locale !== 'zh-TW' && !title) return [];
    return [
      {
        locale,
        title,
        summary: text(formData, `summary.${locale}`),
        body: text(formData, `body.${locale}`),
      },
    ];
  });
  return {
    slug: text(formData, 'slug'),
    type: text(formData, 'type') as CreateEvent['type'],
    status: text(formData, 'status') as CreateEvent['status'],
    startsAt: fromTaipeiInput(text(formData, 'startsAt')) ?? '',
    endsAt: fromTaipeiInput(text(formData, 'endsAt')),
    venue: optional(formData, 'venue'),
    address: optional(formData, 'address'),
    url: optional(formData, 'url'),
    coverImageUrl: optional(formData, 'coverImageUrl'),
    productId: optional(formData, 'productId'),
    translations,
  };
}

export async function saveEventAction(
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  if (!(await ensureAccessToken())) return { error: UNAUTHORIZED };
  const api = await actionApi();
  const id = text(formData, 'id');
  if (!id) {
    const { data, error, response } = await api.POST('/v1/admin/events', {
      body: eventBody(formData),
    });
    if (!response.ok || !data) return { error: toActionError(error, response.status) };
    redirect(`/events/${data.id}?created=1`);
  }
  const { error, response } = await api.PATCH('/v1/admin/events/{id}', {
    params: { path: { id } },
    body: eventBody(formData),
  });
  if (!response.ok) return { error: toActionError(error, response.status) };
  refresh();
  return { saved: true };
}

export async function deleteEventAction(id: string): Promise<ActionResult> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi();
  const { error, response } = await api.DELETE('/v1/admin/events/{id}', {
    params: { path: { id } },
  });
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  return { ok: true, data: undefined };
}

type CreateBanner = Schemas['CreateBannerDto'];

function bannerTranslations(formData: FormData): CreateBanner['translations'] {
  return LOCALES.flatMap((locale) => {
    const title = text(formData, `title.${locale}`);
    if (locale !== 'zh-TW' && !title) return [];
    return [
      {
        locale,
        title,
        subtitle: optional(formData, `subtitle.${locale}`),
        ctaLabel: optional(formData, `ctaLabel.${locale}`),
      },
    ];
  });
}

export async function saveBannerAction(
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  if (!(await ensureAccessToken())) return { error: UNAUTHORIZED };
  const api = await actionApi();
  const id = text(formData, 'id');
  const body = {
    status: text(formData, 'status') as CreateBanner['status'],
    theme: text(formData, 'theme') as CreateBanner['theme'],
    linkUrl: optional(formData, 'linkUrl'),
    imageUrl: optional(formData, 'imageUrl'),
    startsAt: fromTaipeiInput(text(formData, 'startsAt')),
    endsAt: fromTaipeiInput(text(formData, 'endsAt')),
    sortOrder: Number(text(formData, 'sortOrder') || 0),
    translations: bannerTranslations(formData),
  };
  if (!id) {
    const { data, error, response } = await api.POST('/v1/admin/banners', {
      body: { ...body, placement: text(formData, 'placement') as CreateBanner['placement'] },
    });
    if (!response.ok || !data) return { error: toActionError(error, response.status) };
    redirect(`/banners?edit=${data.id}`);
  }
  const { error, response } = await api.PATCH('/v1/admin/banners/{id}', {
    params: { path: { id } },
    body,
  });
  if (!response.ok) return { error: toActionError(error, response.status) };
  refresh();
  return { saved: true };
}

export async function deleteBannerAction(id: string): Promise<ActionResult> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi();
  const { error, response } = await api.DELETE('/v1/admin/banners/{id}', {
    params: { path: { id } },
  });
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  return { ok: true, data: undefined };
}
