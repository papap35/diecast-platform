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

export interface CouponFormState {
  error?: ActionError;
  saved?: boolean;
}

type CreateCoupon = Schemas['CreateCouponDto'];

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
};
const optionalInt = (formData: FormData, key: string) => {
  const value = text(formData, key);
  return value === '' ? null : Number(value);
};

/** 新增與編輯共用的欄位（優惠碼與類型只在新增時送出） */
function couponBody(formData: FormData) {
  return {
    name: text(formData, 'name'),
    value: Number(text(formData, 'value') || 0),
    minSubtotal: Number(text(formData, 'minSubtotal') || 0),
    maxDiscount: optionalInt(formData, 'maxDiscount'),
    minTier: (text(formData, 'minTier') || null) as CreateCoupon['minTier'],
    appliesToLimited: formData.get('appliesToLimited') === 'on',
    usageLimit: optionalInt(formData, 'usageLimit'),
    perMemberLimit: Number(text(formData, 'perMemberLimit') || 1),
    startsAt: fromTaipeiInput(text(formData, 'startsAt')),
    endsAt: fromTaipeiInput(text(formData, 'endsAt')),
    isActive: formData.get('isActive') === 'on',
  };
}

export async function saveCouponAction(
  _prev: CouponFormState,
  formData: FormData,
): Promise<CouponFormState> {
  if (!(await ensureAccessToken())) return { error: UNAUTHORIZED };
  const api = await actionApi();
  const id = text(formData, 'id');
  if (!id) {
    const { data, error, response } = await api.POST('/v1/admin/coupons', {
      body: {
        ...couponBody(formData),
        code: text(formData, 'code'),
        type: text(formData, 'type') as CreateCoupon['type'],
      },
    });
    if (!response.ok || !data) return { error: toActionError(error, response.status) };
    redirect(`/coupons/${data.id}?created=1`);
  }
  const { error, response } = await api.PATCH('/v1/admin/coupons/{id}', {
    params: { path: { id } },
    body: couponBody(formData),
  });
  if (!response.ok) return { error: toActionError(error, response.status) };
  refresh();
  return { saved: true };
}

export async function deleteCouponAction(id: string): Promise<ActionResult> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi();
  const { error, response } = await api.DELETE('/v1/admin/coupons/{id}', {
    params: { path: { id } },
  });
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  return { ok: true, data: undefined };
}

type CreateCampaign = Schemas['CreateCampaignDto'];
const LOCALES = ['zh-TW', 'en', 'zh-CN'] as const;

function campaignBody(formData: FormData): CreateCampaign {
  return {
    name: text(formData, 'name'),
    minTier: (text(formData, 'minTier') || null) as CreateCampaign['minTier'],
    translations: LOCALES.flatMap((locale) => {
      const subject = text(formData, `subject.${locale}`);
      if (locale !== 'zh-TW' && !subject) return [];
      return [{ locale, subject, body: text(formData, `body.${locale}`) }];
    }),
  };
}

export async function saveCampaignAction(
  _prev: CouponFormState,
  formData: FormData,
): Promise<CouponFormState> {
  if (!(await ensureAccessToken())) return { error: UNAUTHORIZED };
  const api = await actionApi();
  const id = text(formData, 'id');
  if (!id) {
    const { data, error, response } = await api.POST('/v1/admin/campaigns', {
      body: campaignBody(formData),
    });
    if (!response.ok || !data) return { error: toActionError(error, response.status) };
    redirect(`/campaigns/${data.id}?created=1`);
  }
  const { error, response } = await api.PATCH('/v1/admin/campaigns/{id}', {
    params: { path: { id } },
    body: campaignBody(formData),
  });
  if (!response.ok) return { error: toActionError(error, response.status) };
  refresh();
  return { saved: true };
}

export async function deleteCampaignAction(id: string): Promise<ActionResult> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi();
  const { error, response } = await api.DELETE('/v1/admin/campaigns/{id}', {
    params: { path: { id } },
  });
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  return { ok: true, data: undefined };
}

/** 排程寄送：scheduledAt 為空表示立即 */
export async function scheduleCampaignAction(
  id: string,
  scheduledAt: string | null,
): Promise<ActionResult> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi();
  const { error, response } = await api.POST('/v1/admin/campaigns/{id}/schedule', {
    params: { path: { id } },
    body: { scheduledAt: fromTaipeiInput(scheduledAt) },
  });
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  refresh();
  return { ok: true, data: undefined };
}

export async function cancelCampaignAction(id: string): Promise<ActionResult> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi();
  const { error, response } = await api.POST('/v1/admin/campaigns/{id}/cancel', {
    params: { path: { id } },
  });
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  refresh();
  return { ok: true, data: undefined };
}

export async function testCampaignAction(
  id: string,
  locale: (typeof LOCALES)[number],
): Promise<ActionResult> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi();
  const { error, response } = await api.POST('/v1/admin/campaigns/{id}/test', {
    params: { path: { id } },
    body: { locale },
  });
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  return { ok: true, data: undefined };
}
