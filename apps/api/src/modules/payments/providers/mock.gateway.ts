import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../../config/config.module.js';
import type { CheckoutContext, GatewayRedirect, PaymentGateway } from './payment-gateway.js';

/**
 * 模擬金流：導向 API 內建的模擬付款頁，可選擇付款成功或失敗。
 * 讓示範站與本機開發不需要任何金流帳號也能跑完整個付款流程。
 */
@Injectable()
export class MockGateway implements PaymentGateway {
  readonly provider = 'MOCK' as const;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  createCheckout({ payment }: CheckoutContext): GatewayRedirect {
    return {
      type: 'redirect',
      url: `${this.config.API_PUBLIC_URL}/v1/payments/mock/${payment.merchantTradeNo}`,
      fields: {},
    };
  }
}
