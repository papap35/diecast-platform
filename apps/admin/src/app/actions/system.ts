'use server';

import type { Schemas } from '@paddock64/api-client';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  type ActionError,
  type ActionResult,
  toActionError,
  UNAUTHORIZED,
} from '@/lib/action-result';
import { actionApi } from '@/lib/api';
import { clearSession, ensureAccessToken } from '@/lib/session';

export interface SystemFormState {
  error?: ActionError;
  saved?: boolean;
}

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

/** 新增或編輯管理員；編輯自己時表單不會帶角色與啟用狀態 */
export async function saveAdminUserAction(
  _prev: SystemFormState,
  formData: FormData,
): Promise<SystemFormState> {
  if (!(await ensureAccessToken())) return { error: UNAUTHORIZED };
  const api = await actionApi();
  const id = text(formData, 'id');
  if (!id) {
    const { data, error, response } = await api.POST('/v1/admin/admins', {
      body: {
        email: text(formData, 'email'),
        name: text(formData, 'name'),
        roleId: text(formData, 'roleId'),
        password: String(formData.get('password') ?? ''),
      },
    });
    if (!response.ok || !data) return { error: toActionError(error, response.status) };
    redirect(`/admins?edit=${data.id}`);
  }
  const accessEditable = formData.get('accessEditable') === '1';
  const { error, response } = await api.PATCH('/v1/admin/admins/{id}', {
    params: { path: { id } },
    body: {
      name: text(formData, 'name'),
      ...(accessEditable
        ? { roleId: text(formData, 'roleId'), isActive: formData.get('isActive') === 'on' }
        : {}),
    },
  });
  if (!response.ok) return { error: toActionError(error, response.status) };
  refresh();
  return { saved: true };
}

export async function resetAdminPasswordAction(
  id: string,
  _prev: SystemFormState,
  formData: FormData,
): Promise<SystemFormState> {
  if (!(await ensureAccessToken())) return { error: UNAUTHORIZED };
  const api = await actionApi();
  const { error, response } = await api.POST('/v1/admin/admins/{id}/password', {
    params: { path: { id } },
    body: { password: String(formData.get('password') ?? '') },
  });
  if (!response.ok) return { error: toActionError(error, response.status) };
  return { saved: true };
}

export async function saveRoleAction(
  _prev: SystemFormState,
  formData: FormData,
): Promise<SystemFormState> {
  if (!(await ensureAccessToken())) return { error: UNAUTHORIZED };
  const api = await actionApi();
  const id = text(formData, 'id');
  const permissions = formData
    .getAll('permissions')
    .map(String) as Schemas['CreateRoleDto']['permissions'];
  const name = text(formData, 'name');
  const description = text(formData, 'description') || null;
  if (!id) {
    const { data, error, response } = await api.POST('/v1/admin/roles', {
      body: { key: text(formData, 'key'), name, description, permissions },
    });
    if (!response.ok || !data) return { error: toActionError(error, response.status) };
    redirect(`/roles?edit=${data.id}`);
  }
  const { error, response } = await api.PATCH('/v1/admin/roles/{id}', {
    params: { path: { id } },
    body: { name, description, permissions },
  });
  if (!response.ok) return { error: toActionError(error, response.status) };
  refresh();
  return { saved: true };
}

export async function deleteRoleAction(id: string): Promise<ActionResult> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi();
  const { error, response } = await api.DELETE('/v1/admin/roles/{id}', {
    params: { path: { id } },
  });
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  return { ok: true, data: undefined };
}

/** 修改自己的密碼；成功後所有裝置都要重新登入 */
export async function changePasswordAction(
  _prev: SystemFormState,
  formData: FormData,
): Promise<SystemFormState> {
  if (!(await ensureAccessToken())) return { error: UNAUTHORIZED };
  const newPassword = String(formData.get('newPassword') ?? '');
  if (newPassword !== String(formData.get('confirmPassword') ?? '')) {
    return {
      error: {
        code: 'PASSWORD_MISMATCH',
        message: 'Passwords do not match',
        fields: { confirmPassword: 'mismatch' },
      },
    };
  }
  const api = await actionApi();
  const { error, response } = await api.POST('/v1/admin/auth/password', {
    body: { currentPassword: String(formData.get('currentPassword') ?? ''), newPassword },
  });
  if (!response.ok) return { error: toActionError(error, response.status) };
  await clearSession();
  redirect('/login?passwordChanged=1');
}
