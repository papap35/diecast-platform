import 'server-only';
import type { Schemas } from '@paddock64/api-client';
import { cache } from 'react';
import { serverApi } from './api';

export type AdminProfile = Schemas['AdminProfileDto'];

/** 同一次請求內只向 API 取一次目前管理員（含角色權限） */
export const getAdmin = cache(async (): Promise<AdminProfile | null> => {
  const api = await serverApi();
  const { data } = await api.GET('/v1/admin/auth/me');
  return data ?? null;
});

export function can(admin: AdminProfile | null, permission: string): boolean {
  const granted = admin?.role.permissions ?? [];
  return granted.includes('*') || granted.includes(permission);
}
