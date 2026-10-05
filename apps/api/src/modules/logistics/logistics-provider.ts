import type { GatewayRedirect } from '../../common/http/gateway-redirect.dto.js';
import type {
  IntegrationProvider,
  Order,
  OrderItem,
  Prisma,
  ShippingMethod,
} from '../../generated/prisma/client.js';

export type CvsMethod = Exclude<ShippingMethod, 'HOME_DELIVERY'>;

export interface CvsMapRequest {
  /** 選店工作階段代碼，選店完成後原樣帶回 */
  token: string;
  method: CvsMethod;
  mobile: boolean;
}

export interface ShipmentRequest {
  merchantTradeNo: string;
  createdAt: Date;
  order: Order & { items: OrderItem[] };
}

export interface CreatedShipment {
  logisticsId: string;
  shipmentNo: string | null;
  validationNo: string | null;
  statusCode: string;
  statusMessage: string;
  raw: Prisma.InputJsonValue;
}

/** 物流商介面：新增物流商（例如直接串接黑貓、嘉里大榮）只要實作這個介面 */
export interface LogisticsProvider {
  readonly provider: IntegrationProvider;
  cvsMap(request: CvsMapRequest): GatewayRedirect;
  createShipment(request: ShipmentRequest): Promise<CreatedShipment>;
}
