'use server';

import type { Schemas } from '@paddock64/api-client';
import { refresh } from 'next/cache';
import { type ActionError, toActionError, UNAUTHORIZED } from '@/lib/action-result';
import { actionApi } from '@/lib/api';
import { ensureAccessToken } from '@/lib/session';

export interface SettingsFormState {
  error?: ActionError;
  saved?: boolean;
}

const FIELDS = [
  'homeDeliveryFee',
  'homeFreeShippingThreshold',
  'cvsFee',
  'cvsFreeShippingThreshold',
  'paymentTimeoutMinutes',
  'limitedPaymentTimeoutMinutes',
] as const;

export async function saveSettingsAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  if (!(await ensureAccessToken())) return { error: UNAUTHORIZED };
  const api = await actionApi();
  const body = Object.fromEntries(
    FIELDS.map((key) => [key, Number(formData.get(key))]),
  ) as Schemas['UpdateStoreSettingsDto'];
  const { error, response } = await api.PUT('/v1/admin/settings', { body });
  if (!response.ok) return { error: toActionError(error, response.status) };
  refresh();
  return { saved: true };
}
