'use server';

import { createApiClient } from '@paddock64/api-client';
import { cookies } from 'next/headers';
import { redirect } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { type ActionError, toActionError } from '@/lib/action-result';
import { API_BASE_URL } from '@/lib/env';
import { clearSession, REFRESH_COOKIE, setSession } from '@/lib/session';

export interface AuthFormState {
  error?: ActionError;
  values?: { email?: string; name?: string };
}

const publicApi = () => createApiClient({ baseUrl: API_BASE_URL });

/** 只允許站內相對路徑，避免登入後被導向外部網站 */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === 'string' ? value : '';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/account';
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = formData.get('locale') as AppLocale;
  const email = String(formData.get('email') ?? '');
  const { data, error, response } = await publicApi().POST('/v1/auth/login', {
    body: { email, password: String(formData.get('password') ?? '') },
  });
  if (!response.ok || !data)
    return { error: toActionError(error, response.status), values: { email } };

  await setSession(data.tokens);
  redirect({ href: safeNext(formData.get('next')), locale });
  return {};
}

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = formData.get('locale') as AppLocale;
  const email = String(formData.get('email') ?? '');
  const name = String(formData.get('name') ?? '');
  const { data, error, response } = await publicApi().POST('/v1/auth/register', {
    body: {
      email,
      name,
      password: String(formData.get('password') ?? ''),
      locale,
      marketingOptIn: formData.get('marketingOptIn') === 'on',
    },
  });
  if (!response.ok || !data)
    return { error: toActionError(error, response.status), values: { email, name } };

  await setSession(data.tokens);
  redirect({ href: safeNext(formData.get('next')), locale });
  return {};
}

export async function logoutAction(formData: FormData): Promise<void> {
  const locale = formData.get('locale') as AppLocale;
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await publicApi()
      .POST('/v1/auth/logout', { body: { refreshToken } })
      .catch(() => undefined);
  }
  await clearSession();
  redirect({ href: '/', locale });
}
