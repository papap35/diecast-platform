'use client';

import type { Schemas } from '@paddock64/api-client';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { type ProfileFormState, updateProfileAction } from '@/app/actions/account';
import { Button } from './ui/button';
import { Field, Input, Select } from './ui/field';

export function ProfileForm({ profile }: { profile: Schemas['MemberProfileDto'] }) {
  const t = useTranslations('account');
  const te = useTranslations('errors');
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(
    updateProfileAction,
    {},
  );
  const fields = state.error?.fields ?? {};

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label={t('name')} name="name" error={fields.name}>
        <Input id="name" name="name" defaultValue={profile.name} required />
      </Field>
      <Field label={t('phone')} name="phone" error={fields.phone}>
        <Input
          id="phone"
          name="phone"
          inputMode="tel"
          defaultValue={profile.phone ?? ''}
          placeholder="0912345678"
        />
      </Field>
      <Field label={t('email')} name="email">
        <Input id="email" value={profile.email} disabled readOnly />
      </Field>
      <Field label={t('language')} name="locale">
        <Select id="locale" name="locale" defaultValue={profile.locale}>
          <option value="zh-TW">繁體中文</option>
          <option value="en">English</option>
          <option value="zh-CN">简体中文</option>
        </Select>
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink-2 sm:col-span-2">
        <input
          type="checkbox"
          name="marketingOptIn"
          defaultChecked={profile.marketingOptIn}
          className="h-4 w-4 accent-ink"
        />
        {t('marketing')}
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {t('save')}
        </Button>
        {state.saved ? <span className="text-sm text-ok">{t('saved')}</span> : null}
        {state.error && !state.error.fields ? (
          <span className="text-sm text-accent">
            {te.has(state.error.code) ? te(state.error.code) : state.error.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
