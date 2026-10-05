import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../../config/config.module.js';
import { ProviderError } from '../../../common/errors/provider-error.js';
import type { GatewayRedirect } from '../../../common/http/gateway-redirect.dto.js';
import { generateCheckMacValue, verifyCheckMacValue } from '../../ecpay/checkmac.js';
import {
  buildCreateParams,
  buildMapParams,
  goodsSummary,
  LOGISTICS_ENDPOINTS,
  LOGISTICS_KIND,
  parseCreateResponse,
} from '../ecpay-logistics.js';
import type {
  CreatedShipment,
  CvsMapRequest,
  LogisticsProvider,
  ShipmentRequest,
} from '../logistics-provider.js';

/** 綠界物流：C2C 超商店到店（7-ELEVEN、全家、萊爾富、OK）與黑貓宅配。檢查碼使用 MD5 */
@Injectable()
export class EcpayLogistics implements LogisticsProvider {
  readonly provider = 'ECPAY' as const;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  private get endpoint(): string {
    return LOGISTICS_ENDPOINTS[this.config.ECPAY_ENV];
  }

  private sign(params: Record<string, string>): Record<string, string> {
    return {
      ...params,
      CheckMacValue: generateCheckMacValue(
        params,
        this.config.ECPAY_LOGISTICS_HASH_KEY,
        this.config.ECPAY_LOGISTICS_HASH_IV,
        'md5',
      ),
    };
  }

  verify(params: Record<string, string>): boolean {
    return verifyCheckMacValue(
      params,
      this.config.ECPAY_LOGISTICS_HASH_KEY,
      this.config.ECPAY_LOGISTICS_HASH_IV,
      'md5',
    );
  }

  cvsMap({ token, method, mobile }: CvsMapRequest): GatewayRedirect {
    const fields = buildMapParams({
      merchantId: this.config.ECPAY_LOGISTICS_MERCHANT_ID,
      token,
      logisticsSubType: LOGISTICS_KIND[method].logisticsSubType,
      serverReplyUrl: `${this.config.API_PUBLIC_URL}/v1/logistics/ecpay/map-reply`,
      mobile,
    });
    return { type: 'form_post', url: `${this.endpoint}/Express/map`, fields: this.sign(fields) };
  }

  async createShipment({
    order,
    merchantTradeNo,
    createdAt,
  }: ShipmentRequest): Promise<CreatedShipment> {
    const config = this.config;
    const params = buildCreateParams({
      merchantId: config.ECPAY_LOGISTICS_MERCHANT_ID,
      merchantTradeNo,
      tradeDate: createdAt,
      kind: LOGISTICS_KIND[order.shippingMethod],
      goodsAmount: order.total,
      goodsName: goodsSummary(order.items),
      sender: {
        name: config.SHIPPER_NAME,
        phone: config.SHIPPER_PHONE,
        cellPhone: config.SHIPPER_CELLPHONE,
        zipCode: config.SHIPPER_ZIP,
        address: config.SHIPPER_ADDRESS,
      },
      receiver: {
        name: order.recipientName,
        cellPhone: order.recipientPhone,
        email: order.recipientEmail,
        storeId: order.cvsStoreId ?? undefined,
        zipCode: order.postalCode ?? undefined,
        city: order.city ?? undefined,
        address: [order.city, order.district, order.addressLine].filter(Boolean).join(''),
      },
      serverReplyUrl: `${config.API_PUBLIC_URL}/v1/logistics/ecpay/notify`,
    });

    let body: string;
    try {
      const res = await fetch(`${this.endpoint}/Express/Create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(this.sign(params)),
        signal: AbortSignal.timeout(15_000),
      });
      body = await res.text();
      if (!res.ok) throw new ProviderError(`綠界物流回應 HTTP ${res.status}`);
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(`無法連線綠界物流：${(error as Error).message}`);
    }

    const result = parseCreateResponse(body);
    if (!result.ok) throw new ProviderError(result.error ?? body);
    const fields = result.fields;
    return {
      logisticsId: fields.AllPayLogisticsID ?? '',
      // 超商為寄貨編號，宅配為託運單號
      shipmentNo: fields.CVSPaymentNo || fields.BookingNote || null,
      validationNo: fields.CVSValidationNo || null,
      statusCode: fields.RtnCode ?? '300',
      statusMessage: fields.RtnMsg ?? '',
      raw: fields,
    };
  }
}
