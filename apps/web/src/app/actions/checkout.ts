'use server';

import type { Schemas } from '@paddock64/api-client';
import { refresh } from 'next/cache';
import { getPathname } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import {
  type ActionError,
  type ActionResult,
  toActionError,
  UNAUTHORIZED,
} from '@/lib/action-result';
import { actionApi } from '@/lib/api';
import { SITE_URL } from '@/lib/env';
import { ensureAccessToken } from '@/lib/session';

type Instruction = Schemas['PaymentInstructionDto'];
type CheckoutBody = Schemas['CheckoutDto'];

export interface CheckoutState {
  error?: ActionError;
  orderNo?: string;
  payment?: Instruction;
}

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
};

/** 建立訂單後立刻開始付款，回傳導向金流頁的方式給前端 */
export async function placeOrderAction(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  if (!(await ensureAccessToken())) return { error: UNAUTHORIZED };
  const locale = formData.get('locale') as AppLocale;
  const buyNow = text(formData, 'buyNowProductId');
  const quantity = Number(formData.get('buyNowQuantity') ?? 1);

  const body: CheckoutBody = {
    shippingMethod: formData.get('shippingMethod') as CheckoutBody['shippingMethod'],
    recipientName: text(formData, 'recipientName') ?? '',
    recipientPhone: text(formData, 'recipientPhone') ?? '',
    recipientEmail: text(formData, 'recipientEmail'),
    postalCode: text(formData, 'postalCode'),
    city: text(formData, 'city'),
    district: text(formData, 'district'),
    addressLine: text(formData, 'addressLine'),
    cvsStoreId: text(formData, 'cvsStoreId'),
    cvsStoreName: text(formData, 'cvsStoreName'),
    cvsStoreAddress: text(formData, 'cvsStoreAddress'),
    invoiceType: formData.get('invoiceType') as CheckoutBody['invoiceType'],
    invoiceCarrierNum: text(formData, 'invoiceCarrierNum'),
    invoiceDonationCode: text(formData, 'invoiceDonationCode'),
    invoiceTaxId: text(formData, 'invoiceTaxId'),
    invoiceTitle: text(formData, 'invoiceTitle'),
    note: text(formData, 'note'),
    locale,
    ...(buyNow ? { items: [{ productId: buyNow, quantity }] } : {}),
  };

  const api = await actionApi(locale);
  const order = await api.POST('/v1/orders', { body });
  if (!order.response.ok || !order.data) {
    return { error: toActionError(order.error, order.response.status) };
  }

  // 不呼叫 refresh()：購物車已清空，重新渲染結帳頁會被導回購物車，蓋掉接下來的付款導向
  const payment = await startPayment(order.data.orderNo, locale);
  if (!payment.ok) return { orderNo: order.data.orderNo, error: payment.error };
  return { orderNo: order.data.orderNo, payment: payment.data };
}

export async function startPaymentAction(
  orderNo: string,
  locale: AppLocale,
): Promise<ActionResult<Instruction>> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  return startPayment(orderNo, locale);
}

async function startPayment(
  orderNo: string,
  locale: AppLocale,
): Promise<ActionResult<Instruction>> {
  const api = await actionApi(locale);
  const returnUrl = `${SITE_URL}${getPathname({ href: `/account/orders/${orderNo}`, locale })}`;
  const { data, error, response } = await api.POST('/v1/orders/{orderNo}/payments', {
    params: { path: { orderNo }, query: { locale } },
    body: { returnUrl },
  });
  if (!response.ok || !data) return { ok: false, error: toActionError(error, response.status) };
  return { ok: true, data };
}

export async function cancelOrderAction(orderNo: string, locale: AppLocale): Promise<ActionResult> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi(locale);
  const { error, response } = await api.POST('/v1/orders/{orderNo}/cancel', {
    params: { path: { orderNo } },
  });
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  refresh();
  return { ok: true, data: undefined };
}
