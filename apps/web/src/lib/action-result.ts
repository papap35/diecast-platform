import type { ApiErrorBody, FieldError } from '@paddock64/api-client';

export interface ActionError {
  code: string;
  message: string;
  /** 欄位驗證錯誤：欄位名稱 → 第一則訊息 */
  fields?: Record<string, string>;
  details?: unknown;
}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: ActionError };

/** 把 API 錯誤回應轉成前端好用的格式 */
export function toActionError(error: unknown, status: number): ActionError {
  const body = error as Partial<ApiErrorBody> | undefined;
  const code = body?.error?.code ?? (status === 401 ? 'UNAUTHORIZED' : 'INTERNAL_ERROR');
  const details = body?.error?.details;
  const fields = Array.isArray(details)
    ? Object.fromEntries(
        (details as FieldError[]).map((d) => [d.field.split('.')[0]!, d.messages[0] ?? '']),
      )
    : undefined;
  return { code, message: body?.error?.message ?? 'Request failed', fields, details };
}

export const UNAUTHORIZED: ActionError = { code: 'UNAUTHORIZED', message: 'Login required' };
