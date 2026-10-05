import createClient, { type Middleware } from 'openapi-fetch';
import type { components, paths } from './schema.js';

export type { paths } from './schema.js';
export type Schemas = components['schemas'];

/** API 統一錯誤格式（見 API 文件「錯誤格式」） */
export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface FieldError {
  field: string;
  messages: string[];
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** 欄位驗證錯誤明細（VALIDATION_FAILED 時） */
  get fieldErrors(): FieldError[] {
    return Array.isArray(this.details) ? (this.details as FieldError[]) : [];
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  /** 取得目前的 access token（每次請求都會呼叫，方便搭配自動刷新） */
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
  locale?: string;
  fetch?: typeof globalThis.fetch;
}

export function createApiClient(options: ApiClientOptions) {
  const client = createClient<paths>({
    baseUrl: options.baseUrl.replace(/\/$/, ''),
    fetch: options.fetch,
  });

  const auth: Middleware = {
    async onRequest({ request }) {
      const token = await options.getAccessToken?.();
      if (token) request.headers.set('Authorization', `Bearer ${token}`);
      if (options.locale) request.headers.set('Accept-Language', options.locale);
      return request;
    },
  };
  client.use(auth);
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** 把 openapi-fetch 的回傳結果轉成「成功回資料、失敗丟 ApiError」 */
export async function unwrap<T>(
  promise: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await promise;
  if (response.ok) return data as T;
  const body = error as Partial<ApiErrorBody> | undefined;
  throw new ApiError(
    response.status,
    body?.error?.code ?? 'INTERNAL_ERROR',
    body?.error?.message ?? response.statusText,
    body?.error?.details,
  );
}

export function isApiError(error: unknown, code?: string): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}
