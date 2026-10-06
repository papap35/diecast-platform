'use client';

import type { Schemas } from '@paddock64/api-client';
import { useTranslations } from 'next-intl';
import { type ComponentProps, useState } from 'react';
import { saveSettingsAction, type SettingsFormState } from '@/app/actions/settings';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import { useFormAction } from '@/lib/use-form-action';
import { Button } from './ui/button';
import { Field, Input } from './ui/field';

type Settings = Schemas['StoreSettingsDto'];

/** 前後綴單位的數字輸入框（NT$、分鐘） */
function UnitInput({
  prefix,
  suffix,
  className,
  ...props
}: ComponentProps<'input'> & { prefix?: string; suffix?: string }) {
  return (
    <div className="relative">
      {prefix ? (
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-mute">
          {prefix}
        </span>
      ) : null}
      <Input
        type="number"
        inputMode="numeric"
        step={1}
        required
        className={cn('tabular', prefix && 'pl-12', suffix && 'pr-14', className)}
        {...props}
      />
      {suffix ? (
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-mute">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const tm = useTranslations('members');
  const { state, formAction, onSubmit, pending, formRef } = useFormAction<SettingsFormState>(
    saveSettingsAction,
    {},
  );
  const [cvs, setCvs] = useState(settings.cvsFreeShippingThreshold);
  const [home, setHome] = useState(settings.homeFreeShippingThreshold);
  const fields = state.error?.fields ?? {};
  const minutes = t('minutes');

  /** 預覽各等級的免運門檻（與 API 相同規則：冠軍車手六折、傳奇車手全站免運） */
  const threshold = (base: number, tier: string) => {
    if (tier === 'LEGEND' || base <= 0) return t('free');
    return t('over', { amount: formatPrice(tier === 'CHAMPION' ? Math.round(base * 0.6) : base) });
  };

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="flex flex-col gap-4">
      {state.error ? (
        <p role="alert" className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
          {te.has(state.error.code) ? te(state.error.code) : state.error.message}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="rounded-xl bg-ok-soft px-4 py-3 text-sm text-ok">
          {t('saved')}
        </p>
      ) : null}

      <fieldset disabled={pending} className="card flex flex-col gap-4 p-5">
        <legend className="sr-only">{t('shipping')}</legend>
        <div>
          <h2 className="text-sm font-semibold">{t('shipping')}</h2>
          <p className="text-xs text-mute">{t('shippingHint')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('cvsFee')} name="cvsFee" hint={t('cvsFeeHint')} error={fields.cvsFee}>
            <UnitInput
              id="cvsFee"
              name="cvsFee"
              prefix="NT$"
              min={0}
              max={1000}
              defaultValue={settings.cvsFee}
            />
          </Field>
          <Field
            label={t('cvsThreshold')}
            name="cvsFreeShippingThreshold"
            hint={t('thresholdHint')}
            error={fields.cvsFreeShippingThreshold}
          >
            <UnitInput
              id="cvsFreeShippingThreshold"
              name="cvsFreeShippingThreshold"
              prefix="NT$"
              min={0}
              max={100000}
              defaultValue={settings.cvsFreeShippingThreshold}
              onChange={(event) => setCvs(Number(event.target.value) || 0)}
            />
          </Field>
          <Field label={t('homeFee')} name="homeDeliveryFee" error={fields.homeDeliveryFee}>
            <UnitInput
              id="homeDeliveryFee"
              name="homeDeliveryFee"
              prefix="NT$"
              min={0}
              max={1000}
              defaultValue={settings.homeDeliveryFee}
            />
          </Field>
          <Field
            label={t('homeThreshold')}
            name="homeFreeShippingThreshold"
            hint={t('thresholdHint')}
            error={fields.homeFreeShippingThreshold}
          >
            <UnitInput
              id="homeFreeShippingThreshold"
              name="homeFreeShippingThreshold"
              prefix="NT$"
              min={0}
              max={100000}
              defaultValue={settings.homeFreeShippingThreshold}
              onChange={(event) => setHome(Number(event.target.value) || 0)}
            />
          </Field>
        </div>
        <div className="rounded-xl bg-canvas p-4">
          <p className="mb-2 text-xs font-semibold text-ink-2">{t('tierPreview')}</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-mute">
                <th className="py-1 font-medium">{t('tier')}</th>
                <th className="py-1 font-medium">{t('cvs')}</th>
                <th className="py-1 font-medium">{t('home')}</th>
              </tr>
            </thead>
            <tbody>
              {(['ROOKIE', 'DRIVER', 'CHAMPION', 'LEGEND'] as const).map((tier) => (
                <tr key={tier} className="border-t border-line">
                  <td className="py-1.5">{tm(`tiers.${tier}`)}</td>
                  <td className="py-1.5 tabular">{threshold(cvs, tier)}</td>
                  <td className="py-1.5 tabular">{threshold(home, tier)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-mute">{t('tierPreviewHint')}</p>
        </div>
      </fieldset>

      <fieldset disabled={pending} className="card flex flex-col gap-4 p-5">
        <legend className="sr-only">{t('payment')}</legend>
        <div>
          <h2 className="text-sm font-semibold">{t('payment')}</h2>
          <p className="text-xs text-mute">{t('paymentHint')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('paymentTimeout')}
            name="paymentTimeoutMinutes"
            hint={t('paymentTimeoutHint')}
            error={fields.paymentTimeoutMinutes}
          >
            <UnitInput
              id="paymentTimeoutMinutes"
              name="paymentTimeoutMinutes"
              suffix={minutes}
              min={10}
              max={4320}
              defaultValue={settings.paymentTimeoutMinutes}
            />
          </Field>
          <Field
            label={t('limitedTimeout')}
            name="limitedPaymentTimeoutMinutes"
            hint={t('limitedTimeoutHint')}
            error={fields.limitedPaymentTimeoutMinutes}
          >
            <UnitInput
              id="limitedPaymentTimeoutMinutes"
              name="limitedPaymentTimeoutMinutes"
              suffix={minutes}
              min={5}
              max={120}
              defaultValue={settings.limitedPaymentTimeoutMinutes}
            />
          </Field>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? tc('saving') : tc('save')}
        </Button>
        <p className="text-xs text-mute">{t('appliesHint')}</p>
      </div>
    </form>
  );
}
