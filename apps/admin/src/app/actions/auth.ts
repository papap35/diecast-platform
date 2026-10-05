'use server';

import { createApiClient } from '@paddock64/api-client';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isLocale, LOCALE_COOKIE } from '@/i18n/config';
import { type ActionError, toActionError } from '@/lib/action-result';
import { API_BASE_URL } from '@/lib/env';
import { clearSession, REFRESH_COOKIE, setSession } from '@/lib/session';

export interface LoginState {
  error?: ActionError;
  email?: string;
}

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === 'string' ? value : '';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '');
  const api = createApiClient({ baseUrl: API_BASE_URL });
  const { data, error, response } = await api.POST('/v1/admin/auth/login', {
    body: { email, password: String(formData.get('password') ?? '') },
  });
  if (!response.ok || !data) return { error: toActionError(error, response.status), email };
  await setSession(data.tokens);
  redirect(safeNext(formData.get('next')));
}

export async function logoutAction(): Promise<void> {
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await createApiClient({ baseUrl: API_BASE_URL })
      .POST('/v1/admin/auth/logout', { body: { refreshToken } })
      .catch(() => undefined);
  }
  await clearSession();
  redirect('/login');
}

export async function setLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
