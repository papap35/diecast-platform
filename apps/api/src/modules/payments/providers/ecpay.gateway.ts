import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../../config/config.module.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { generateCheckMacValue, verifyCheckMacValue } from './ecpay-checkmac.js';
import type { CheckoutContext, GatewayRedirect, PaymentGateway } from './payment-gateway.js';

const ENDPOINTS = {
  stage: 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
  production: 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5',
} as const;

/** 綠界付款頁語系：預設繁中，英文與簡中另外指定 */
const LANGUAGE: Partial<Record<Locale, string>> = { en: 'ENG', 'zh-CN': 'CHI' };

/** 綠界要求的交易時間格式：yyyy/MM/dd HH:mm:ss（台灣時間） */
export function ecpayTradeDate(date: Date): string {
  const taipei = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${taipei.getUTCFullYear()}/${pad(taipei.getUTCMonth() + 1)}/${pad(taipei.getUTCDate())} ${pad(
    taipei.getUTCHours(),
  )}:${pad(taipei.getUTCMinutes())}:${pad(taipei.getUTCSeconds())}`;
}

/** 商品名稱以 # 分隔，總長不得超過 400 字元 */
export function ecpayItemName(items: { name: string; quantity: number }[]): string {
  const joined = items.map((item) => `${item.name.replace(/#/g, '')} x ${item.quantity}`).join('#');
  return joined.length <= 400 ? joined : `${joined.slice(0, 396)}...`;
}

/**
 * 綠界全方位金流（AIO）。目前只開信用卡：ATM、超商代碼屬於「先取號、之後付款」的非同步流程，
 * 與限量商品 10 分鐘付款期限的設計衝突，因此不開放。
 */
@Injectable()
export class EcpayGateway implements PaymentGateway {
  readonly provider = 'ECPAY' as const;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  createCheckout({ order, payment, locale, returnUrl }: CheckoutContext): GatewayRedirect {
    const api = this.config.API_PUBLIC_URL;
    const fields: Record<string, string> = {
      MerchantID: this.config.ECPAY_MERCHANT_ID,
      MerchantTradeNo: payment.merchantTradeNo,
      MerchantTradeDate: ecpayTradeDate(payment.createdAt),
      PaymentType: 'aio',
      TotalAmount: String(payment.amount),
      TradeDesc: `Paddock 64 ${order.orderNo}`,
      ItemName: ecpayItemName(order.items),
      ReturnURL: `${api}/v1/payments/ecpay/notify`,
      OrderResultURL: `${api}/v1/payments/ecpay/return`,
      ClientBackURL: returnUrl,
      ChoosePayment: 'Credit',
      EncryptType: '1',
      NeedExtraPaidInfo: 'N',
      CustomField1: order.orderNo,
    };
    const language = LANGUAGE[locale];
    if (language) fields.Language = language;
    fields.CheckMacValue = generateCheckMacValue(
      fields,
      this.config.ECPAY_HASH_KEY,
      this.config.ECPAY_HASH_IV,
    );
    return { type: 'form_post', url: ENDPOINTS[this.config.ECPAY_ENV], fields };
  }

  verify(params: Record<string, string>): boolean {
    return verifyCheckMacValue(params, this.config.ECPAY_HASH_KEY, this.config.ECPAY_HASH_IV);
  }
}
