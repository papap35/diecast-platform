'use client';

import type { Schemas } from '@paddock64/api-client';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import {
  changePasswordAction,
  deleteRoleAction,
  resetAdminPasswordAction,
  saveAdminUserAction,
  saveRoleAction,
  type SystemFormState,
} from '@/app/actions/system';
import { Button } from './ui/button';
import { Checkbox, Field, Input, Select, Textarea } from './ui/field';
import { useFormAction } from '@/lib/use-form-action';

type AdminUser = Schemas['AdminUserDto'];
type Role = Schemas['RoleDto'];

/** 權限分組（角色編輯畫面依此排列） */
export const PERMISSION_GROUPS = [
  { key: 'dashboard', permissions: ['dashboard:read'] },
  { key: 'catalog', permissions: ['product:read', 'product:write', 'catalog:write'] },
  { key: 'sales', permissions: ['order:read', 'order:write', 'member:read', 'member:write'] },
  { key: 'marketing', permissions: ['content:write', 'marketing:write', 'report:read'] },
  { key: 'system', permissions: ['settings:write', 'admin:manage'] },
] as const;

export function FormFeedback({ state }: { state: SystemFormState }) {
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
        {te.has(state.error.code) ? te(state.error.code) : state.error.message}
      </p>
    );
  }
  return state.saved ? (
    <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-xs text-ok">
      {tc('saved')}
    </p>
  ) : null;
}

export function AdminUserForm({
  admin,
  roles,
  isSelf,
}: {
  admin?: AdminUser;
  roles: Role[];
  isSelf: boolean;
}) {
  const t = useTranslations('admins');
  const tc = useTranslations('common');
  const { state, formAction, onSubmit, pending, formRef } = useFormAction(saveAdminUserAction, {});
  const fields = state.error?.fields ?? {};
  const accessEditable = !isSelf;

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={onSubmit}
      key={admin?.id ?? 'new'}
      className="card flex flex-col gap-4 p-5"
    >
      <h2 className="text-sm font-semibold">{admin ? `${tc('edit')}：${admin.name}` : t('new')}</h2>
      <fieldset disabled={pending} className="contents">
        {admin ? <input type="hidden" name="id" value={admin.id} /> : null}
        {accessEditable ? <input type="hidden" name="accessEditable" value="1" /> : null}
        <FormFeedback state={state} />
        <Field label={t('email')} name="email" error={fields.email}>
          <Input
            id="email"
            name="email"
            type="email"
            required
            disabled={!!admin}
            defaultValue={admin?.email}
            autoComplete="off"
          />
        </Field>
        <Field label={t('name')} name="name" error={fields.name}>
          <Input id="name" name="name" required maxLength={50} defaultValue={admin?.name} />
        </Field>
        <Field
          label={t('role')}
          name="roleId"
          hint={isSelf ? t('selfHint') : undefined}
          error={fields.roleId}
        >
          <Select
            id="roleId"
            name="roleId"
            required
            disabled={!accessEditable}
            defaultValue={admin?.role.id ?? roles.find((role) => !role.isLocked)?.id}
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </Select>
        </Field>
        {admin ? (
          <Checkbox
            name="isActive"
            defaultChecked={admin.isActive}
            disabled={!accessEditable}
            label={t('active')}
          />
        ) : (
          <Field
            label={t('initialPassword')}
            name="password"
            hint={t('initialPasswordHint')}
            error={fields.password}
          >
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
            />
          </Field>
        )}
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? tc('saving') : admin ? tc('save') : t('create')}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

export function ResetPasswordForm({ admin }: { admin: AdminUser }) {
  const t = useTranslations('admins');
  const { state, formAction, onSubmit, pending, formRef } = useFormAction(
    resetAdminPasswordAction.bind(null, admin.id),
    {},
    { resetOnSuccess: true },
  );
  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={onSubmit}
      key={admin.id}
      className="card flex flex-col gap-3 p-5"
    >
      <h2 className="text-sm font-semibold">{t('resetPassword')}</h2>
      <p className="text-xs text-mute">{t('resetPasswordHint')}</p>
      {state.saved ? (
        <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-xs text-ok">
          {t('passwordReset')}
        </p>
      ) : (
        <FormFeedback state={state} />
      )}
      <Field label={t('newPassword')} name="reset-password" error={state.error?.fields?.password}>
        <Input
          id="reset-password"
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
        />
      </Field>
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {t('resetPassword')}
        </Button>
      </div>
    </form>
  );
}

export function RoleForm({
  role,
  permissions,
  isOwnRole,
}: {
  role?: Role;
  permissions: string[];
  isOwnRole: boolean;
}) {
  const t = useTranslations('roles');
  const tc = useTranslations('common');
  const router = useRouter();
  const { state, formAction, onSubmit, pending, formRef } = useFormAction(saveRoleAction, {});
  const [deleting, startDelete] = useTransition();
  const fields = state.error?.fields ?? {};
  const locked = role?.isLocked ?? false;
  const granted = new Set(role?.permissions ?? []);
  const known = new Set<string>(PERMISSION_GROUPS.flatMap((group) => group.permissions));
  const others = permissions.filter((permission) => !known.has(permission));

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={onSubmit}
      key={role?.id ?? 'new'}
      className="card flex flex-col gap-4 p-5"
    >
      <h2 className="text-sm font-semibold">{role ? `${tc('edit')}：${role.name}` : t('new')}</h2>
      {locked ? (
        <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-mute">{t('lockedHint')}</p>
      ) : null}
      <fieldset disabled={pending || locked} className="contents">
        {role ? <input type="hidden" name="id" value={role.id} /> : null}
        <FormFeedback state={state} />
        <Field
          label={t('key')}
          name="key"
          hint={role ? undefined : t('keyHint')}
          error={fields.key}
        >
          <Input
            id="key"
            name="key"
            required
            pattern="[a-z][a-z0-9_]{2,29}"
            disabled={!!role}
            defaultValue={role?.key}
          />
        </Field>
        <Field label={t('name')} name="name" error={fields.name}>
          <Input id="name" name="name" required maxLength={30} defaultValue={role?.name} />
        </Field>
        <Field label={t('description')} name="description">
          <Textarea
            id="description"
            name="description"
            rows={2}
            maxLength={200}
            defaultValue={role?.description ?? ''}
          />
        </Field>
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-ink-2">{t('permissions')}</p>
          {isOwnRole ? <p className="text-xs text-mute">{t('ownRoleHint')}</p> : null}
          {[...PERMISSION_GROUPS, { key: 'other', permissions: others }]
            .filter((group) => group.permissions.length > 0)
            .map((group) => (
              <fieldset key={group.key} className="flex flex-col gap-1.5">
                <legend className="mb-1 text-[11px] font-semibold tracking-widest text-mute uppercase">
                  {t(`groups.${group.key}`)}
                </legend>
                {group.permissions.map((permission) => (
                  <Checkbox
                    key={permission}
                    name="permissions"
                    value={permission}
                    defaultChecked={locked || granted.has(permission)}
                    label={
                      <span>
                        {t.has(`labels.${permission}`) ? t(`labels.${permission}`) : permission}
                        <span className="ml-1.5 font-mono text-[11px] text-faint">
                          {permission}
                        </span>
                      </span>
                    }
                  />
                ))}
              </fieldset>
            ))}
        </div>
        {!locked ? (
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? tc('saving') : role ? tc('save') : t('create')}
            </Button>
            {role && !role.isSystem && role.adminCount === 0 ? (
              <Button
                type="button"
                variant="danger"
                disabled={deleting}
                onClick={() => {
                  if (!window.confirm(t('deleteConfirm'))) return;
                  startDelete(async () => {
                    const result = await deleteRoleAction(role.id);
                    if (result.ok) router.push('/roles');
                  });
                }}
              >
                {tc('delete')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </fieldset>
    </form>
  );
}

export function ChangePasswordForm() {
  const t = useTranslations('account');
  const { state, formAction, onSubmit, pending, formRef } = useFormAction(changePasswordAction, {});
  const fields = state.error?.fields ?? {};
  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={onSubmit}
      className="card flex max-w-md flex-col gap-4 p-5"
    >
      <FormFeedback state={state} />
      <Field label={t('currentPassword')} name="currentPassword">
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </Field>
      <Field
        label={t('newPassword')}
        name="newPassword"
        hint={t('newPasswordHint')}
        error={fields.newPassword}
      >
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
        />
      </Field>
      <Field
        label={t('confirmPassword')}
        name="confirmPassword"
        error={fields.confirmPassword ? t('mismatch') : undefined}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
        />
      </Field>
      <p className="text-xs text-mute">{t('logoutNotice')}</p>
      <div>
        <Button type="submit" disabled={pending}>
          {t('submit')}
        </Button>
      </div>
    </form>
  );
}
