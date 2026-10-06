import 'server-only';
import type { Schemas } from '@paddock64/api-client';
import { cache } from 'react';
import { serverApi } from './api';

export type StoreSettings = Schemas['StoreSettingsDto'];

/** 運費、免運門檻與付款期限（後台「系統設定」可調整）；同一次請求只向 API 取一次 */
export const storeSettings = cache(async (): Promise<StoreSettings | null> => {
  const api = await serverApi();
  const { data } = await api.GET('/v1/settings').catch(() => ({ data: undefined }));
  return data ?? null;
});
