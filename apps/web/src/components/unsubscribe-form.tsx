'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { unsubscribeAction, type UnsubscribeState } from '@/app/actions/unsubscribe';
import { Link } from '@/i18n/navigation';
import { Button } from './ui/button';

export function UnsubscribeForm({ token }: { token: string }) {
  const t = useTranslations('unsubscribe');
  const te = useTranslations('errors');
  const [state, formAction, pending] = useActionState<UnsubscribeState, FormData>(
    unsubscribeAction,
    {},
  );

  if (state.done) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-xl bg-ok-soft px-4 py-3 text-sm text-ok">
          {t('done')}
        </p>
        <p className="text-sm text-mute">
          {t('resubscribe')}{' '}
          <Link href="/account" className="font-semibold text-ink underline underline-offset-4">
            {t('account')}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm text-ink-2">{t('confirm')}</p>
      {state.error ? (
        <p role="alert" className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
          {te.has(state.error.code) ? te(state.error.code) : state.error.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {t('submit')}
      </Button>
    </form>
  );
}
