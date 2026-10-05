'use client';

import type { Schemas } from '@paddock64/api-client';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { cancelOrderAction, startPaymentAction } from '@/app/actions/checkout';
import type { AppLocale } from '@/i18n/routing';
import { PaymentRedirect } from './payment-redirect';
import { Button } from './ui/button';

export function OrderActions({ order }: { order: Schemas['OrderDto'] }) {
  const t = useTranslations('orders');
  const te = useTranslations('errors');
  const locale = useLocale() as AppLocale;
  const [pending, startTransition] = useTransition();
  const [instruction, setInstruction] = useState<Schemas['PaymentInstructionDto'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!order.canPay && !order.canCancel) return null;
  if (instruction) return <PaymentRedirect instruction={instruction} />;

  const fail = (code: string, message: string) => setError(te.has(code) ? te(code) : message);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {order.canPay ? (
        <Button
          variant="accent"
          size="lg"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await startPaymentAction(order.orderNo, locale);
              if (result.ok) setInstruction(result.data);
              else fail(result.error.code, result.error.message);
            })
          }
        >
          {t('pay')}
        </Button>
      ) : null}
      {order.canCancel ? (
        <Button
          variant="danger"
          size="lg"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(t('cancelConfirm'))) return;
            startTransition(async () => {
              const result = await cancelOrderAction(order.orderNo, locale);
              if (!result.ok) fail(result.error.code, result.error.message);
            });
          }}
        >
          {t('cancel')}
        </Button>
      ) : null}
      {error ? <p className="w-full text-sm text-accent">{error}</p> : null}
    </div>
  );
}
