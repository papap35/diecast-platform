import 'server-only';
import { createApiClient } from '@paddock64/api-client';
import { API_BASE_URL } from './env';
import { ensureAccessToken, readAccessToken } from './session';

/** Server Component 用：讀取目前 cookie 中的 access token（刷新由 proxy 處理） */
export async function serverApi(locale?: string) {
  const token = await readAccessToken();
  return createApiClient({ baseUrl: API_BASE_URL, getAccessToken: () => token, locale });
}

/** Server Action 用：必要時先刷新權杖 */
export async function actionApi(locale?: string) {
  const token = await ensureAccessToken();
  return createApiClient({ baseUrl: API_BASE_URL, getAccessToken: () => token, locale });
}
