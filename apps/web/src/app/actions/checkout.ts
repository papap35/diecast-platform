'use server';

import type { Schemas } from '@paddock64/api-client';
import { refresh } from 'next/cache';
import { headers } from 'next/headers';
import { getPathname } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import {
  type ActionError,
  type ActionResult,
  toActionError,
  UNAUTHORIZED,
} from '@/lib/action-result';
import { actionApi } from '@/lib/api';
import { saveCheckoutDraft } from '@/lib/checkout-draft';
import { SITE_URL } from '@/lib/env';
import { ensureAccessToken } from '@/lib/session';

type Instruction = Schemas['PaymentInstructionDto'];
type CheckoutBody = Schemas['CheckoutDto'];

export interface CheckoutState {
  error?: ActionError;
  orderNo?: string;
  payment?: Instruction;
}

export interface CvsMapState {
  error?: ActionError;
  instruction?: Schemas['CvsMapInstructionDto'];
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
    couponCode: text(formData, 'couponCode'),
    locale,
    ...(buyNow ? { items: [{ productId: buyNow, quantity }] } : {}),
  };

  const api = await actionApi(locale);
  const order = await api.POST('/v1/orders', { body });
  if (!order.response.ok || !order.data) {
    return { error: toActionError(order.error, order.response.status) };
  }

  // 不呼叫 refresh()、也不改 cookie（例如清除選店草稿；草稿 30 分鐘後自動失效）：
  // 兩者都會讓結帳頁重新渲染，購物車已清空會被導回購物車，蓋掉接下來的付款導向
  const payment = await startPayment(order.data.orderNo, locale);
  if (!payment.ok) return { orderNo: order.data.orderNo, error: payment.error };
  return { orderNo: order.data.orderNo, payment: payment.data };
}

/**
 * 開啟超商電子地圖：先暫存已填寫的資料，選好門市後回到同一個結帳網址（含「立即購買」參數），
 * 頁面再以 cvsToken 取回門市。
 */
export async function openCvsMapAction(
  _prev: CvsMapState,
  formData: FormData,
): Promise<CvsMapState> {
  if (!(await ensureAccessToken())) return { error: UNAUTHORIZED };
  const locale = formData.get('locale') as AppLocale;
  const buyNow = text(formData, 'buyNowProductId');
  const query = buyNow
    ? `?${new URLSearchParams({ buyNow, qty: String(formData.get('buyNowQuantity') ?? 1) })}`
    : '';
  await saveCheckoutDraft(formData);

  const userAgent = (await headers()).get('user-agent') ?? '';
  const api = await actionApi(locale);
  const { data, error, response } = await api.POST('/v1/logistics/cvs-map', {
    params: { query: { locale } },
    body: {
      method: formData.get('shippingMethod') as Schemas['StartCvsMapDto']['method'],
      returnUrl: `${SITE_URL}${getPathname({ href: '/checkout', locale })}${query}`,
      mobile: /Mobi|Android|iPhone|iPad/i.test(userAgent),
    },
  });
  if (!response.ok || !data) return { error: toActionError(error, response.status) };
  return { instruction: data };
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

type CouponPreview = Schemas['CouponPreviewDto'];

/** 結帳頁試算優惠碼（立即購買帶商品，否則以購物車計算） */
export async function previewCouponAction(input: {
  code: string;
  shippingMethod: CheckoutBody['shippingMethod'];
  buyNow?: { productId: string; quantity: number };
}): Promise<ActionResult<CouponPreview>> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi();
  const { data, error, response } = await api.POST('/v1/coupons/preview', {
    body: {
      code: input.code.trim(),
      shippingMethod: input.shippingMethod,
      ...(input.buyNow ? { items: [input.buyNow] } : {}),
    },
  });
  if (!response.ok || !data) return { ok: false, error: toActionError(error, response.status) };
  return { ok: true, data };
}
