'use client';

import type { Schemas } from '@paddock64/api-client';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState, useTransition } from 'react';
import {
  type CouponFormState,
  deleteCouponAction,
  saveCouponAction,
} from '@/app/actions/marketing';
import { benefitParams } from '@/lib/coupons';
import { toTaipeiInput } from '@/lib/format';
import { useFormAction } from '@/lib/use-form-action';
import { Button } from './ui/button';
import { Checkbox, Field, Input, Select } from './ui/field';

type Coupon = Schemas['AdminCouponDetailDto'];
type CouponType = Schemas['AdminCouponDto']['type'];

const TYPES: CouponType[] = ['FIXED', 'PERCENT', 'FREE_SHIPPING'];
const TIERS = ['DRIVER', 'CHAMPION', 'LEGEND'] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card flex flex-col gap-4 p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function CouponForm({ coupon }: { coupon?: Coupon }) {
  const t = useTranslations('coupons');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const router = useRouter();
  const { state, formAction, onSubmit, pending, formRef } = useFormAction<CouponFormState>(
    saveCouponAction,
    {},
  );
  const [deleting, startDelete] = useTransition();
  const [type, setType] = useState<CouponType>(coupon?.type ?? 'FIXED');
  const [value, setValue] = useState(coupon?.value ?? 100);
  const [maxDiscount, setMaxDiscount] = useState<number | null>(coupon?.maxDiscount ?? null);
  const fields = state.error?.fields ?? {};
  const used = (coupon?.usedCount ?? 0) > 0 || (coupon?.redemptions.length ?? 0) > 0;

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="flex flex-col gap-5">
      <fieldset disabled={pending} className="contents">
        {coupon ? <input type="hidden" name="id" value={coupon.id} /> : null}
        {state.error ? (
          <p role="alert" className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
            {te.has(state.error.code) ? te(state.error.code) : state.error.message}
            {state.error.fields ? ` (${Object.values(state.error.fields).join('；')})` : ''}
          </p>
        ) : null}
        {state.saved ? (
          <p role="status" className="rounded-xl bg-ok-soft px-4 py-3 text-sm text-ok">
            {tc('saved')}
          </p>
        ) : null}

        <Section title={t('sections.benefit')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('fields.code')}
              name="code"
              hint={coupon ? t('fields.codeLocked') : t('fields.codeHint')}
              error={fields.code}
            >
              <Input
                id="code"
                name="code"
                required
                disabled={!!coupon}
                defaultValue={coupon?.code}
                className="font-mono uppercase"
                pattern="[A-Za-z0-9_\-]{3,30}"
              />
            </Field>
            <Field
              label={t('fields.name')}
              name="name"
              hint={t('fields.nameHint')}
              error={fields.name}
            >
              <Input id="name" name="name" required maxLength={60} defaultValue={coupon?.name} />
            </Field>
          </div>
          <fieldset className="flex flex-col gap-2" disabled={!!coupon}>
            <legend className="mb-1.5 text-xs font-semibold text-ink-2">
              {t('fields.type')}
              {coupon ? (
                <span className="ml-2 font-normal text-mute">{t('fields.typeLocked')}</span>
              ) : null}
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {TYPES.map((option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-start gap-2 rounded-xl border border-line p-3 text-sm has-[:checked]:border-ink has-[:checked]:bg-canvas"
                >
                  <input
                    type="radio"
                    name="type"
                    value={option}
                    checked={type === option}
                    onChange={() => setType(option)}
                    className="mt-0.5 accent-ink"
                  />
                  <span>
                    <span className="block font-semibold">{t(`types.${option}`)}</span>
                    <span className="text-xs text-mute">{t(`typeHints.${option}`)}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {type !== 'FREE_SHIPPING' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={type === 'PERCENT' ? t('fields.percent') : t('fields.amount')}
                name="value"
                hint={type === 'PERCENT' ? t('fields.percentHint') : undefined}
                error={fields.value}
              >
                <Input
                  id="value"
                  name="value"
                  type="number"
                  min={1}
                  max={type === 'PERCENT' ? 90 : undefined}
                  required
                  value={value}
                  onChange={(event) => setValue(Number(event.target.value))}
                />
              </Field>
              {type === 'PERCENT' ? (
                <Field
                  label={t('fields.maxDiscount')}
                  name="maxDiscount"
                  hint={t('fields.maxDiscountHint')}
                >
                  <Input
                    id="maxDiscount"
                    name="maxDiscount"
                    type="number"
                    min={1}
                    value={maxDiscount ?? ''}
                    onChange={(event) =>
                      setMaxDiscount(event.target.value ? Number(event.target.value) : null)
                    }
                  />
                </Field>
              ) : null}
            </div>
          ) : (
            <input type="hidden" name="value" value="0" />
          )}
          <p className="rounded-lg bg-canvas px-3 py-2 text-sm">
            {t('summary')}：
            <span className="font-semibold">
              {t(`benefit.${type}`, benefitParams({ type, value, maxDiscount }))}
            </span>
          </p>
        </Section>

        <Section title={t('sections.rules')}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label={t('fields.minSubtotal')}
              name="minSubtotal"
              hint={t('fields.minSubtotalHint')}
              error={fields.minSubtotal}
            >
              <Input
                id="minSubtotal"
                name="minSubtotal"
                type="number"
                min={0}
                defaultValue={coupon?.minSubtotal ?? 0}
              />
            </Field>
            <Field label={t('fields.minTier')} name="minTier">
              <Select id="minTier" name="minTier" defaultValue={coupon?.minTier ?? ''}>
                <option value="">{t('allMembers')}</option>
                {TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {t('tierOrAbove', { tier: t(`tiers.${tier}`) })}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('fields.perMemberLimit')} name="perMemberLimit">
              <Input
                id="perMemberLimit"
                name="perMemberLimit"
                type="number"
                min={1}
                max={100}
                defaultValue={coupon?.perMemberLimit ?? 1}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label={t('fields.usageLimit')}
              name="usageLimit"
              hint={
                coupon
                  ? t('fields.usageLimitUsed', { used: coupon.usedCount })
                  : t('fields.usageLimitHint')
              }
              error={fields.usageLimit}
            >
              <Input
                id="usageLimit"
                name="usageLimit"
                type="number"
                min={1}
                defaultValue={coupon?.usageLimit ?? ''}
              />
            </Field>
            <Field label={t('fields.startsAt')} name="startsAt" hint={t('fields.startsAtHint')}>
              <Input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                defaultValue={toTaipeiInput(coupon?.startsAt)}
              />
            </Field>
            <Field
              label={t('fields.endsAt')}
              name="endsAt"
              hint={t('fields.endsAtHint')}
              error={fields.endsAt}
            >
              <Input
                id="endsAt"
                name="endsAt"
                type="datetime-local"
                defaultValue={toTaipeiInput(coupon?.endsAt)}
              />
            </Field>
          </div>
          <div className="flex flex-col gap-2">
            <Checkbox
              name="appliesToLimited"
              defaultChecked={coupon?.appliesToLimited ?? false}
              label={t('fields.appliesToLimited')}
            />
            <Checkbox
              name="isActive"
              defaultChecked={coupon?.isActive ?? true}
              label={t('fields.isActive')}
            />
          </div>
        </Section>

        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? tc('saving') : coupon ? tc('save') : t('create')}
          </Button>
          {coupon && !used ? (
            <Button
              type="button"
              variant="danger"
              disabled={deleting}
              onClick={() => {
                if (!window.confirm(t('deleteConfirm'))) return;
                startDelete(async () => {
                  const result = await deleteCouponAction(coupon.id);
                  if (result.ok) router.push('/coupons');
                });
              }}
            >
              {tc('delete')}
            </Button>
          ) : null}
        </div>
      </fieldset>
    </form>
  );
}
