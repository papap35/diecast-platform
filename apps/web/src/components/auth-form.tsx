'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useActionState, useRef } from 'react';
import { type AuthFormState, loginAction, registerAction } from '@/app/actions/auth';
import { Link } from '@/i18n/navigation';
import { Button } from './ui/button';
import { Field, Input } from './ui/field';

export function AuthForm({ mode, next }: { mode: 'login' | 'register'; next?: string }) {
  const t = useTranslations('auth');
  const te = useTranslations('errors');
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    mode === 'login' ? loginAction : registerAction,
    {},
  );
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const fields = state.error?.fields ?? {};
  const errorText = state.error
    ? te.has(state.error.code)
      ? te(state.error.code)
      : state.error.message
    : null;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {errorText ? (
        <p role="alert" className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent">
          {errorText}
        </p>
      ) : null}

      {mode === 'register' ? (
        <Field label={t('name')} name="name" error={fields.name}>
          <Input
            id="name"
            name="name"
            autoComplete="nickname"
            required
            defaultValue={state.values?.name}
            aria-invalid={!!fields.name}
          />
        </Field>
      ) : null}
      <Field label={t('email')} name="email" error={fields.email}>
        <Input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email}
          aria-invalid={!!fields.email}
        />
      </Field>
      <Field
        label={t('password')}
        name="password"
        error={fields.password}
        hint={mode === 'register' ? t('passwordHint') : undefined}
      >
        <Input
          ref={passwordRef}
          id="password"
          name="password"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          required
          minLength={mode === 'register' ? 8 : undefined}
          aria-invalid={!!fields.password}
        />
      </Field>
      {mode === 'register' ? (
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" name="marketingOptIn" className="h-4 w-4 accent-ink" />
          {t('marketing')}
        </label>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="mt-2">
        {pending ? t('submitting') : mode === 'login' ? t('submitLogin') : t('submitRegister')}
      </Button>

      {mode === 'login' ? (
        <button
          type="button"
          className="rounded-xl border border-dashed border-line-strong px-3 py-2.5 text-left text-xs text-mute hover:border-ink hover:text-ink"
          onClick={() => {
            if (emailRef.current) emailRef.current.value = 'demo@paddock64.dev';
            if (passwordRef.current) passwordRef.current.value = 'Paddock64!demo';
          }}
        >
          <span className="font-semibold text-ink">{t('useDemo')}</span>
          <br />
          {t('demoAccount')}
        </button>
      ) : null}

      <p className="text-center text-sm text-mute">
        {mode === 'login' ? t('noAccount') : t('hasAccount')}{' '}
        <Link
          href={{
            pathname: mode === 'login' ? '/register' : '/login',
            query: next ? { next } : {},
          }}
          className="font-semibold text-ink underline underline-offset-4"
        >
          {mode === 'login' ? t('toRegister') : t('toLogin')}
        </Link>
      </p>
    </form>
  );
}
