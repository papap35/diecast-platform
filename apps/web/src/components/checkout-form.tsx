'use client';

import type { Schemas } from '@paddock64/api-client';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { startTransition, useActionState, useState } from 'react';
import {
  type CheckoutState,
  type CvsMapState,
  openCvsMapAction,
  placeOrderAction,
} from '@/app/actions/checkout';
import type { CheckoutDraft } from '@/lib/checkout-draft';
import { cn } from '@/lib/cn';
import { type AppliedCoupon, CouponField } from './coupon-field';
import { formatPrice } from '@/lib/format';
import { TW_CITIES } from '@/lib/taiwan';
import { useFormAction } from '@/lib/use-form-action';
import { GatewayRedirect } from './gateway-redirect';
import { Button } from './ui/button';
import { Field, Input, Select } from './ui/field';

type Cart = Schemas['CartDto'];
type Profile = Schemas['MemberProfileDto'];
type ShippingMethod = Schemas['ShippingOptionDto']['method'];
type InvoiceType = Schemas['CheckoutDto']['invoiceType'];
type Store = Schemas['CvsSelectionDto'];

const INVOICE_TYPES: InvoiceType[] = [
  'MEMBER_CARRIER',
  'MOBILE_BARCODE',
  'CITIZEN_CERT',
  'DONATION',
  'COMPANY',
];

export function CheckoutForm({
  cart,
  profile,
  buyNow,
  store,
  storeError,
  draft = {},
}: {
  cart: Cart;
  profile: Profile;
  buyNow?: { productId: string; quantity: number };
  /** 電子地圖選好的門市 */
  store?: Store;
  /** 選店失敗原因：cancelled、expired */
  storeError?: string;
  /** 前往電子地圖前已填寫的資料 */
  draft?: CheckoutDraft;
}) {
  const t = useTranslations('checkout');
  const te = useTranslations('errors');
  const tc = useTranslations('cart');
  const to = useTranslations('orders');
  const locale = useLocale();
  const { state, formAction, onSubmit, pending, formRef } = useFormAction<CheckoutState>(
    placeOrderAction,
    {},
  );
  const [mapState, mapAction, mapPending] = useActionState<CvsMapState, FormData>(
    openCvsMapAction,
    {},
  );
  const [method, setMethod] = useState<ShippingMethod>(store?.method ?? 'CVS_711');
  const [invoiceType, setInvoiceType] = useState<InvoiceType>(
    (draft.invoiceType as InvoiceType | undefined) ?? 'MEMBER_CARRIER',
  );
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);

  const isCvs = method !== 'HOME_DELIVERY';
  // 換成其他超商時，原本選的門市不適用
  const selected = isCvs && store?.method === method ? store : undefined;
  const option = cart.shippingOptions.find((o) => o.method === method);
  // 已套用優惠券時以 API 試算結果為準（折扣後金額決定是否免運）
  const pricing = coupon?.method === method ? coupon.preview : null;
  const shippingFee = pricing ? pricing.shippingFee : (option?.fee ?? 0);
  const total = pricing ? pricing.total : cart.subtotal + shippingFee;
  const fields = state.error?.fields ?? {};
  const errorText = state.error
    ? te.has(state.error.code)
      ? te(state.error.code)
      : state.error.message
    : null;
  const mapError = mapState.error
    ? te.has(mapState.error.code)
      ? te(mapState.error.code)
      : mapState.error.message
    : storeError === 'cancelled'
      ? t('storeCancelled')
      : storeError
        ? t('storeExpired')
        : null;

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={onSubmit}
      className="grid gap-8 lg:grid-cols-[1fr_24rem]"
      noValidate
    >
      <input type="hidden" name="locale" value={locale} />
      {buyNow ? (
        <>
          <input type="hidden" name="buyNowProductId" value={buyNow.productId} />
          <input type="hidden" name="buyNowQuantity" value={buyNow.quantity} />
        </>
      ) : null}

      <div className="flex flex-col gap-6">
        <Section title={t('shippingMethod')}>
          <div className="grid gap-3 sm:grid-cols-2">
            {cart.shippingOptions.map((o) => (
              <label
                key={o.method}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-4 transition-colors',
                  method === o.method
                    ? 'border-ink bg-paper'
                    : 'border-line hover:border-line-strong',
                )}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="shippingMethod"
                    value={o.method}
                    checked={method === o.method}
                    onChange={() => setMethod(o.method)}
                    className="h-4 w-4 accent-ink"
                  />
                  <span className="text-sm font-semibold">{t(`methods.${o.method}`)}</span>
                </span>
                <span
                  className={cn('text-xs', o.fee === 0 ? 'font-semibold text-ok' : 'text-mute')}
                >
                  {o.fee === 0 ? t('methodFree') : t('methodFee', { fee: o.fee })}
                </span>
              </label>
            ))}
          </div>

          {isCvs ? (
            <div className="mt-4 space-y-3 rounded-2xl bg-paper p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {selected ? (
                  <div className="min-w-0">
                    <p className="text-xs text-mute">{t('store')}</p>
                    <p className="mt-0.5 font-semibold">{selected.storeName}</p>
                    <p className="text-xs text-mute">
                      {selected.storeAddress} · {t('storeId')} {selected.storeId}
                    </p>
                    <input type="hidden" name="cvsStoreId" value={selected.storeId} />
                    <input type="hidden" name="cvsStoreName" value={selected.storeName} />
                    <input type="hidden" name="cvsStoreAddress" value={selected.storeAddress} />
                  </div>
                ) : (
                  <p className="text-sm font-medium text-ink-2">{t('storeRequired')}</p>
                )}
                {/* 整張表單送到選店 action：已填寫的資料會先暫存，回來時帶回 */}
                <Button
                  type="button"
                  onClick={(event) => {
                    const form = event.currentTarget.form;
                    if (form) startTransition(() => mapAction(new FormData(form)));
                  }}
                  variant={selected ? 'secondary' : 'primary'}
                  size="sm"
                  disabled={mapPending || !!mapState.instruction}
                >
                  {selected ? t('changeStore') : t('pickStore')}
                </Button>
              </div>
              {mapState.instruction ? (
                <GatewayRedirect instruction={mapState.instruction} label={t('openingMap')} />
              ) : (
                <p className="text-xs text-mute">{t('storeMapHint')}</p>
              )}
              {mapError || fields.cvsStoreId ? (
                <p role="alert" className="text-sm text-accent">
                  {mapError ?? fields.cvsStoreId}
                </p>
              ) : null}
            </div>
          ) : null}
        </Section>

        <Section title={t('recipient')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('recipientName')} name="recipientName" error={fields.recipientName}>
              <Input
                id="recipientName"
                name="recipientName"
                autoComplete="name"
                defaultValue={draft.recipientName ?? profile.name}
                required
                aria-invalid={!!fields.recipientName}
              />
            </Field>
            <Field label={t('recipientPhone')} name="recipientPhone" error={fields.recipientPhone}>
              <Input
                id="recipientPhone"
                name="recipientPhone"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0912345678"
                defaultValue={draft.recipientPhone ?? profile.phone ?? ''}
                required
                aria-invalid={!!fields.recipientPhone}
              />
            </Field>
            <Field
              label={t('recipientEmail')}
              name="recipientEmail"
              error={fields.recipientEmail}
              className="sm:col-span-2"
            >
              <Input
                id="recipientEmail"
                name="recipientEmail"
                type="email"
                autoComplete="email"
                defaultValue={draft.recipientEmail ?? profile.email}
                aria-invalid={!!fields.recipientEmail}
              />
            </Field>
          </div>

          {!isCvs ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-[8rem_1fr_1fr]">
              <Field label={t('postalCode')} name="postalCode" error={fields.postalCode}>
                <Input
                  id="postalCode"
                  name="postalCode"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  aria-invalid={!!fields.postalCode}
                />
              </Field>
              <Field label={t('city')} name="city" error={fields.city}>
                <Select id="city" name="city" defaultValue="" aria-invalid={!!fields.city}>
                  <option value="" disabled>
                    —
                  </option>
                  {TW_CITIES.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('district')} name="district" error={fields.district}>
                <Input id="district" name="district" aria-invalid={!!fields.district} />
              </Field>
              <Field
                label={t('addressLine')}
                name="addressLine"
                error={fields.addressLine}
                className="sm:col-span-3"
              >
                <Input
                  id="addressLine"
                  name="addressLine"
                  autoComplete="street-address"
                  aria-invalid={!!fields.addressLine}
                />
              </Field>
            </div>
          ) : null}
        </Section>

        <Section title={t('invoice')}>
          <div className="flex flex-wrap gap-2">
            {INVOICE_TYPES.map((type) => (
              <label
                key={type}
                className={cn(
                  'cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  invoiceType === type
                    ? 'border-ink bg-ink text-white'
                    : 'border-line-strong hover:border-ink',
                )}
              >
                <input
                  type="radio"
                  name="invoiceType"
                  value={type}
                  checked={invoiceType === type}
                  onChange={() => setInvoiceType(type)}
                  className="sr-only"
                />
                {t(`invoiceTypes.${type}`)}
              </label>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {invoiceType === 'MOBILE_BARCODE' || invoiceType === 'CITIZEN_CERT' ? (
              <Field
                label={t('carrierNum')}
                name="invoiceCarrierNum"
                error={fields.invoiceCarrierNum}
                hint={
                  invoiceType === 'MOBILE_BARCODE'
                    ? t('carrierHintMobile')
                    : t('carrierHintCitizen')
                }
              >
                <Input
                  id="invoiceCarrierNum"
                  name="invoiceCarrierNum"
                  placeholder={invoiceType === 'MOBILE_BARCODE' ? '/ABC1234' : 'AB12345678901234'}
                  defaultValue={draft.invoiceCarrierNum}
                  aria-invalid={!!fields.invoiceCarrierNum}
                />
              </Field>
            ) : null}
            {invoiceType === 'DONATION' ? (
              <Field
                label={t('donationCode')}
                name="invoiceDonationCode"
                error={fields.invoiceDonationCode}
              >
                <Input
                  id="invoiceDonationCode"
                  name="invoiceDonationCode"
                  inputMode="numeric"
                  defaultValue={draft.invoiceDonationCode ?? '168001'}
                  aria-invalid={!!fields.invoiceDonationCode}
                />
              </Field>
            ) : null}
            {invoiceType === 'COMPANY' ? (
              <>
                <Field label={t('taxId')} name="invoiceTaxId" error={fields.invoiceTaxId}>
                  <Input
                    id="invoiceTaxId"
                    name="invoiceTaxId"
                    inputMode="numeric"
                    maxLength={8}
                    defaultValue={draft.invoiceTaxId}
                    aria-invalid={!!fields.invoiceTaxId}
                  />
                </Field>
                <Field label={t('invoiceTitle')} name="invoiceTitle" error={fields.invoiceTitle}>
                  <Input
                    id="invoiceTitle"
                    name="invoiceTitle"
                    defaultValue={draft.invoiceTitle}
                    aria-invalid={!!fields.invoiceTitle}
                  />
                </Field>
              </>
            ) : null}
          </div>
        </Section>

        <Section title={t('note')}>
          <textarea
            name="note"
            rows={3}
            maxLength={200}
            defaultValue={draft.note}
            placeholder={t('notePlaceholder')}
            className="w-full rounded-xl border border-line-strong bg-surface p-3.5 text-sm placeholder:text-faint focus:border-ink focus:outline-none"
          />
        </Section>
      </div>

      <aside className="h-fit space-y-4 rounded-3xl bg-surface p-6 ring-1 ring-line lg:sticky lg:top-24">
        <h2 className="text-sm font-semibold">{t('summary')}</h2>
        <ul className="space-y-3">
          {cart.items.map((line) => (
            <li key={line.product.id} className="flex items-center gap-3">
              <div className="relative aspect-[4/3] w-16 shrink-0 overflow-hidden rounded-lg bg-paper ring-1 ring-line">
                {line.product.imageUrl ? (
                  <Image
                    src={line.product.imageUrl}
                    alt=""
                    fill
                    unoptimized
                    sizes="64px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{line.product.name}</p>
                <p className="text-xs text-mute">× {line.quantity}</p>
              </div>
              <span className="text-sm font-semibold tabular">{formatPrice(line.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <CouponField
          method={method}
          buyNow={buyNow}
          applied={coupon}
          onChange={setCoupon}
          initialCode={draft.couponCode}
        />
        <dl className="space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-mute">{tc('subtotal')}</dt>
            <dd className="tabular">{formatPrice(cart.subtotal)}</dd>
          </div>
          {pricing && pricing.discount > 0 ? (
            <div className="flex justify-between text-ok">
              <dt>{t('couponDiscount')}</dt>
              <dd className="tabular">−{formatPrice(pricing.discount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-mute">{tc('shipping')}</dt>
            <dd className="tabular">
              {pricing && pricing.shippingDiscount > 0
                ? t('couponFreeShipping')
                : shippingFee === 0
                  ? t('methodFree')
                  : formatPrice(shippingFee)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-line pt-3 text-base font-bold">
            <dt>{t('total')}</dt>
            <dd className="tabular">{formatPrice(total)}</dd>
          </div>
        </dl>

        {cart.preorderMixed ? (
          <p role="alert" className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">
            {tc('preorderMixed')}
          </p>
        ) : null}
        {errorText && !state.payment ? (
          <p role="alert" className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent">
            {errorText}
          </p>
        ) : null}

        {state.payment ? (
          <GatewayRedirect instruction={state.payment} label={to('paying')} />
        ) : (
          <Button
            type="submit"
            variant="accent"
            size="lg"
            className="w-full"
            disabled={pending || cart.hasIssues || (isCvs && !selected)}
          >
            {pending ? t('placing') : t('placeOrder')}
          </Button>
        )}
        <p className="text-xs text-mute">{t('paymentNote')}</p>
        <p className="text-xs text-faint">{t('agree')}</p>
      </aside>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-surface p-6 ring-1 ring-line">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}
