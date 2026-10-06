'use server';

import { refresh } from 'next/cache';
import { type ActionResult, toActionError, UNAUTHORIZED } from '@/lib/action-result';
import { actionApi } from '@/lib/api';
import { ensureAccessToken } from '@/lib/session';

export async function retryEmailAction(id: string): Promise<ActionResult> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi();
  const { error, response } = await api.POST('/v1/admin/emails/{id}/retry', {
    params: { path: { id } },
  });
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  refresh();
  return { ok: true, data: undefined };
}

export async function retryFailedEmailsAction(): Promise<ActionResult<{ count: number }>> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi();
  const { data, error, response } = await api.POST('/v1/admin/emails/retry-failed');
  if (!response.ok || !data) return { ok: false, error: toActionError(error, response.status) };
  refresh();
  return { ok: true, data };
}
