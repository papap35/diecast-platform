import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../../config/config.module.js';
import type { GatewayRedirect } from '../../../common/http/gateway-redirect.dto.js';
import { randomDigits } from '../../../common/security/random.js';
import type {
  CreatedShipment,
  CvsMapRequest,
  LogisticsProvider,
  ShipmentRequest,
} from '../logistics-provider.js';

/**
 * 模擬物流：選店導向 API 內建的模擬電子地圖，建單產生假的寄貨編號，
 * 物流狀態由後台「模擬物流進度」推進。示範站不需要物流帳號也能跑完整個出貨流程。
 */
@Injectable()
export class MockLogistics implements LogisticsProvider {
  readonly provider = 'MOCK' as const;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  cvsMap({ token }: CvsMapRequest): GatewayRedirect {
    return {
      type: 'redirect',
      url: `${this.config.API_PUBLIC_URL}/v1/logistics/mock/map/${token}`,
      fields: {},
    };
  }

  async createShipment({ order }: ShipmentRequest): Promise<CreatedShipment> {
    const home = order.shippingMethod === 'HOME_DELIVERY';
    return {
      logisticsId: randomDigits(7),
      shipmentNo: randomDigits(home ? 12 : 8),
      validationNo: order.shippingMethod === 'CVS_711' ? randomDigits(4) : null,
      statusCode: '300',
      statusMessage: '訂單處理中（模擬物流）',
      raw: { simulated: true },
    };
  }
}
