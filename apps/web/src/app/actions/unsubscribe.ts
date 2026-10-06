'use server';

import { type ActionError, toActionError } from '@/lib/action-result';
import { serverApi } from '@/lib/api';

export interface UnsubscribeState {
  error?: ActionError;
  done?: boolean;
}

/** 退訂電子報：不需要登入，以信中連結的簽章權杖辨識會員 */
export async function unsubscribeAction(
  _prev: UnsubscribeState,
  formData: FormData,
): Promise<UnsubscribeState> {
  const api = await serverApi();
  const { error, response } = await api.POST('/v1/unsubscribe', {
    body: { token: String(formData.get('token') ?? '') },
  });
  if (!response.ok) return { error: toActionError(error, response.status) };
  return { done: true };
}
