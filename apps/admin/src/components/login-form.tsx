'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useRef } from 'react';
import { type LoginState, loginAction } from '@/app/actions/auth';
import { Button } from './ui/button';
import { Field, Input } from './ui/field';

const DEMO = [
  { role: 'super_admin', email: 'admin@paddock64.dev', password: 'Paddock64!admin' },
  { role: 'operator', email: 'ops@paddock64.dev', password: 'Paddock64!ops' },
  { role: 'customer_service', email: 'cs@paddock64.dev', password: 'Paddock64!cs' },
] as const;

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations('login');
  const te = useTranslations('errors');
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.error ? (
        <p role="alert" className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
          {te.has(state.error.code) ? te(state.error.code) : state.error.message}
        </p>
      ) : null}
      <Field label={t('email')} name="email">
        <Input
          ref={email}
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={state.email}
          required
        />
      </Field>
      <Field label={t('password')} name="password">
        <Input
          ref={password}
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <Button type="submit" disabled={pending} className="mt-1 h-11">
        {pending ? t('submitting') : t('submit')}
      </Button>
      <div className="mt-2 rounded-xl bg-canvas p-3">
        <p className="mb-2 text-xs font-semibold text-mute">{t('demoTitle')}</p>
        <div className="flex flex-col gap-1">
          {DEMO.map((account) => (
            <button
              key={account.email}
              type="button"
              className="flex justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-surface"
              onClick={() => {
                if (email.current) email.current.value = account.email;
                if (password.current) password.current.value = account.password;
              }}
            >
              <span className="font-semibold">{t(`roles.${account.role}`)}</span>
              <span className="text-mute">{account.email}</span>
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
