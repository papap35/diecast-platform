import 'server-only';
import { createApiClient } from '@paddock64/api-client';
import { API_BASE_URL } from './env';
import { ensureAccessToken, readAccessToken } from './session';

export async function serverApi() {
  const token = await readAccessToken();
  return createApiClient({ baseUrl: API_BASE_URL, getAccessToken: () => token });
}

export async function actionApi() {
  const token = await ensureAccessToken();
  return createApiClient({ baseUrl: API_BASE_URL, getAccessToken: () => token });
}
