'use server';

import { refresh } from 'next/cache';
import type { AppLocale } from '@/i18n/routing';
import { type ActionError, toActionError, UNAUTHORIZED } from '@/lib/action-result';
import { actionApi } from '@/lib/api';
import { ensureAccessToken } from '@/lib/session';

export interface ProfileFormState {
  error?: ActionError;
  saved?: boolean;
}

export async function updateProfileAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  if (!(await ensureAccessToken())) return { error: UNAUTHORIZED };
  const phone = String(formData.get('phone') ?? '').trim();
  const api = await actionApi();
  const { error, response } = await api.PATCH('/v1/me', {
    body: {
      name: String(formData.get('name') ?? '').trim(),
      ...(phone ? { phone } : {}),
      locale: formData.get('locale') as AppLocale,
      marketingOptIn: formData.get('marketingOptIn') === 'on',
    },
  });
  if (!response.ok) return { error: toActionError(error, response.status) };
  refresh();
  return { saved: true };
}
