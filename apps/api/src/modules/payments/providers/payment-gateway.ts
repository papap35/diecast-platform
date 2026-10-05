import type { Locale } from '../../../common/i18n/locale.js';
import type { Payment, PaymentProvider } from '../../../generated/prisma/client.js';
import type { OrderWithDetail } from '../../orders/orders.service.js';

export interface CheckoutContext {
  order: OrderWithDetail;
  payment: Payment;
  locale: Locale;
  /** 付款完成後導回的網址 */
  returnUrl: string;
}

export interface GatewayRedirect {
  type: 'redirect' | 'form_post';
  url: string;
  fields: Record<string, string>;
}

/** 金流閘道介面：新增金流商（例如 Stripe、LINE Pay）只要實作這個介面 */
export interface PaymentGateway {
  readonly provider: PaymentProvider;
  createCheckout(context: CheckoutContext): GatewayRedirect;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
