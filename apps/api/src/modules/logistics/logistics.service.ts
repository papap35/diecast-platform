import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/config.module.js';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { ProviderError } from '../../common/errors/provider-error.js';
import { frontendOrigins, resolveReturnUrl, withQuery } from '../../common/http/return-url.js';
import type { Locale } from '../../common/i18n/locale.js';
import { randomCode } from '../../common/security/random.js';
import type {
  IntegrationProvider,
  OrderStatus,
  Prisma,
  ShipmentStatus,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { RedisService } from '../../infra/redis/redis.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { generateMerchantTradeNo } from '../orders/order-number.js';
import { isConvenienceStore } from '../orders/order-rules.js';
import { OrdersService } from '../orders/orders.service.js';
import type { CvsMapInstructionDto, CvsSelectionDto, StartCvsMapDto } from './dto/logistics.dto.js';
import { type CvsSelection, LOGISTICS_KIND } from './ecpay-logistics.js';
import type { CvsMethod, LogisticsProvider } from './logistics-provider.js';
import { EcpayLogistics } from './providers/ecpay-logistics.provider.js';
import { MockLogistics } from './providers/mock-logistics.js';

/** 選店工作階段：從開啟電子地圖到結帳完成的保留時間 */
const MAP_SESSION_TTL_SECONDS = 30 * 60;

interface MapSession {
  memberId: string;
  method: CvsMethod;
  returnUrl: string;
  selection?: CvsSelection;
}

export interface ShipmentStatusUpdate {
  code: string;
  message: string;
  /** null：只記錄訊息，不改變物流狀態（未收錄的綠界代碼） */
  status: ShipmentStatus | null;
  shipmentNo?: string;
  validationNo?: string;
  raw: Prisma.InputJsonValue;
}

/** 物流狀態只往前推進（綠界可能重送或亂序通知）；退回與取件同為終點 */
const SHIPMENT_RANK: Record<ShipmentStatus, number> = {
  CREATED: 0,
  IN_TRANSIT: 1,
  ARRIVED: 2,
  PICKED_UP: 3,
  RETURNED: 3,
};

/** 物流狀態對應的訂單狀態；訂單依序推進，不會跳過中間狀態 */
const ORDER_TARGET: Partial<Record<ShipmentStatus, OrderStatus>> = {
  IN_TRANSIT: 'SHIPPED',
  ARRIVED: 'SHIPPED',
  PICKED_UP: 'COMPLETED',
};
const FULFILMENT_FLOW: OrderStatus[] = ['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'];
const FLOW_MESSAGE: Partial<Record<OrderStatus, string>> = {
  PROCESSING: '已建立物流單，開始備貨',
  SHIPPED: '包裹已寄出',
  COMPLETED: '顧客已取件／簽收',
};

/** 模擬物流用的綠界狀態代碼（與 7-ELEVEN 店到店相同） */
const MOCK_STATUS: Record<Exclude<ShipmentStatus, 'CREATED'>, { code: string; message: string }> = {
  IN_TRANSIT: { code: '2068', message: '交貨便收件（模擬）' },
  ARRIVED: { code: '2073', message: '商品配達買家取貨門市（模擬）' },
  PICKED_UP: { code: '2067', message: '消費者成功取件（模擬）' },
  RETURNED: { code: '2074', message: '消費者七天未取，商品退回（模擬）' },
};

/**
 * 可以建立物流單的情況：已付款或處理中且還沒有物流單，或包裹退回後重新寄送
 * （退回時訂單可能已是「已出貨」）。
 */
export function canCreateShipment(
  orderStatus: OrderStatus,
  shipmentStatus: ShipmentStatus | undefined,
): boolean {
  if (shipmentStatus && shipmentStatus !== 'RETURNED') return false;
  return (
    orderStatus === 'PAID' ||
    orderStatus === 'PROCESSING' ||
    (orderStatus === 'SHIPPED' && shipmentStatus === 'RETURNED')
  );
}

@Injectable()
export class LogisticsService {
  private readonly logger = new Logger(LogisticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly orders: OrdersService,
    private readonly notifications: NotificationsService,
    private readonly mock: MockLogistics,
    private readonly ecpay: EcpayLogistics,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private get provider(): LogisticsProvider {
    return this.config.LOGISTICS_PROVIDER === 'ecpay' ? this.ecpay : this.mock;
  }

  // ── 超商電子地圖選店 ──

  /**
   * 開始選店：建立工作階段（Redis，30 分鐘）並回傳導向電子地圖的方式。
   * 選好的門市由地圖送回 API，再導回 returnUrl?cvsToken=…，前台用代碼取回門市資料。
   */
  async startCvsMap(
    memberId: string,
    dto: StartCvsMapDto,
    locale: Locale,
  ): Promise<CvsMapInstructionDto> {
    if (!isConvenienceStore(dto.method)) {
      throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, '宅配不需要選擇門市');
    }
    const method = dto.method as CvsMethod;
    const token = randomCode(20);
    const session: MapSession = {
      memberId,
      method,
      returnUrl: resolveReturnUrl(
        dto.returnUrl,
        `${this.config.WEB_BASE_URL}/${locale}/checkout`,
        frontendOrigins(this.config),
      ),
    };
    await this.redis.set(mapKey(token), JSON.stringify(session), 'EX', MAP_SESSION_TTL_SECONDS);
    const redirect = this.provider.cvsMap({ token, method, mobile: dto.mobile ?? false });
    return { ...redirect, token };
  }

  async getMapSession(token: string): Promise<MapSession | null> {
    if (!/^[0-9A-Z]{20}$/.test(token)) return null;
    const raw = await this.redis.get(mapKey(token));
    return raw ? (JSON.parse(raw) as MapSession) : null;
  }

  /** 電子地圖送回選店結果，回傳要導回前台的網址 */
  async completeCvsMap(token: string, selection: CvsSelection | null): Promise<string> {
    const session = await this.getMapSession(token);
    if (!session) return `${this.config.WEB_BASE_URL}/checkout?cvsError=expired`;
    if (!selection) return withQuery(session.returnUrl, { cvsError: 'cancelled' });
    await this.redis.set(mapKey(token), JSON.stringify({ ...session, selection }), 'KEEPTTL');
    return withQuery(session.returnUrl, { cvsToken: token });
  }

  async getCvsSelection(memberId: string, token: string): Promise<CvsSelectionDto> {
    const session = await this.getMapSession(token);
    if (!session?.selection || session.memberId !== memberId) {
      throw AppException.notFound(ErrorCode.CVS_SELECTION_NOT_FOUND, '選店資料不存在或已過期');
    }
    return session.selection;
  }

  // ── 物流單 ──

  /** 後台建立物流單（綠界 Express/Create）；已付款的訂單同時轉為處理中 */
  async createShipment(orderId: string, adminId: string): Promise<void> {
    const lock = `lock:shipment:${orderId}`;
    if ((await this.redis.set(lock, adminId, 'EX', 30, 'NX')) !== 'OK') {
      throw AppException.conflict(ErrorCode.CONFLICT, '物流單建立中，請稍候');
    }
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { items: { orderBy: { id: 'asc' } }, shipment: true },
      });
      if (!order) throw AppException.notFound(ErrorCode.ORDER_NOT_FOUND, '找不到這筆訂單');
      if (!canCreateShipment(order.status, order.shipment?.status)) {
        throw AppException.conflict(
          ErrorCode.SHIPMENT_NOT_ALLOWED,
          order.shipment && order.shipment.status !== 'RETURNED'
            ? '這筆訂單已有物流單'
            : '只有已付款、處理中或包裹退回的訂單可以建立物流單',
        );
      }
      const reship = order.shipment?.status === 'RETURNED';

      const provider = this.provider;
      const merchantTradeNo = generateMerchantTradeNo();
      let created;
      try {
        created = await provider.createShipment({ order, merchantTradeNo, createdAt: new Date() });
      } catch (error) {
        const message = error instanceof ProviderError ? error.message : '物流服務發生錯誤';
        if (!(error instanceof ProviderError)) this.logger.error(error);
        await this.prisma.orderEvent.create({
          data: {
            orderId,
            type: 'SHIPMENT_FAILED',
            actorType: 'ADMIN',
            actorId: adminId,
            message: `建立物流單失敗：${message}`,
          },
        });
        throw new AppException(
          ErrorCode.PROVIDER_ERROR,
          `建立物流單失敗：${message}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      const kind = LOGISTICS_KIND[order.shippingMethod];
      await this.prisma.$transaction(async (tx) => {
        const data = {
          provider: provider.provider,
          logisticsType: kind.logisticsType,
          logisticsSubType: kind.logisticsSubType,
          merchantTradeNo,
          logisticsId: created.logisticsId,
          shipmentNo: created.shipmentNo,
          validationNo: created.validationNo,
          status: 'CREATED' as const,
          statusCode: created.statusCode,
          statusMessage: created.statusMessage,
          raw: created.raw,
        };
        await tx.shipment.upsert({
          where: { orderId },
          create: { orderId, ...data },
          update: data,
        });
        await tx.orderEvent.create({
          data: {
            orderId,
            type: 'SHIPMENT_CREATED',
            actorType: 'ADMIN',
            actorId: adminId,
            message: `${reship ? '重新寄送，' : ''}已建立物流單（${providerLabel(provider.provider)}），寄貨編號 ${created.shipmentNo ?? '—'}`,
          },
        });
        const current = await tx.order.findUniqueOrThrow({
          where: { id: orderId },
          include: { items: true },
        });
        if (current.status === 'PAID') {
          await this.orders.applyTransition(
            tx,
            current,
            'PROCESSING',
            { type: 'ADMIN', id: adminId },
            FLOW_MESSAGE.PROCESSING,
          );
        }
      });
    } finally {
      await this.redis.del(lock);
    }
  }

  /**
   * 套用物流狀態（綠界通知或模擬），並把訂單推進到對應狀態。
   * 冪等：同一個狀態重送只記錄一次事件；物流狀態只往前推進。
   */
  async applyStatus(merchantTradeNo: string, update: ShipmentStatusUpdate): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: { merchantTradeNo },
        include: { order: { include: { items: true } } },
      });
      if (!shipment) return false;

      const next =
        update.status && SHIPMENT_RANK[update.status] > SHIPMENT_RANK[shipment.status]
          ? update.status
          : shipment.status;
      await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          status: next,
          statusCode: update.code,
          statusMessage: update.message,
          ...(update.shipmentNo ? { shipmentNo: update.shipmentNo } : {}),
          ...(update.validationNo ? { validationNo: update.validationNo } : {}),
          raw: update.raw,
        },
      });
      if (shipment.statusCode !== update.code) {
        await tx.orderEvent.create({
          data: {
            orderId: shipment.orderId,
            type: next === 'RETURNED' ? 'SHIPMENT_RETURNED' : 'SHIPMENT_STATUS',
            actorType: 'SYSTEM',
            message:
              next === 'RETURNED'
                ? `包裹已退回：${update.message}（${update.code}），請聯繫顧客重新寄送或辦理退款`
                : `${update.message}（${update.code}）`,
          },
        });
      }
      if (next !== shipment.status) await this.advanceOrder(tx, shipment.order, next);
      if (next === 'ARRIVED' && shipment.status !== 'ARRIVED' && shipment.order.cvsStoreName) {
        await this.notifications.notify(tx, {
          memberId: shipment.order.memberId,
          type: 'ORDER_ARRIVED',
          params: { orderNo: shipment.order.orderNo, store: shipment.order.cvsStoreName },
          link: `/account/orders/${shipment.order.orderNo}`,
        });
      }
      return true;
    });
  }

  /** 後台模擬物流進度（僅模擬物流的物流單） */
  async simulate(orderId: string, status: Exclude<ShipmentStatus, 'CREATED'>): Promise<void> {
    const shipment = await this.prisma.shipment.findUnique({ where: { orderId } });
    if (!shipment) throw AppException.notFound(ErrorCode.NOT_FOUND, '這筆訂單還沒有物流單');
    if (shipment.provider !== 'MOCK') {
      throw AppException.badRequest(ErrorCode.SHIPMENT_NOT_ALLOWED, '只有模擬物流可以手動推進狀態');
    }
    if (SHIPMENT_RANK[status] <= SHIPMENT_RANK[shipment.status]) {
      throw AppException.conflict(ErrorCode.SHIPMENT_NOT_ALLOWED, '物流狀態只能往前推進');
    }
    await this.applyStatus(shipment.merchantTradeNo, {
      ...MOCK_STATUS[status],
      status,
      raw: { simulated: true, status },
    });
  }

  private async advanceOrder(
    tx: Prisma.TransactionClient,
    order: Prisma.OrderGetPayload<{ include: { items: true } }>,
    shipmentStatus: ShipmentStatus,
  ): Promise<void> {
    const target = ORDER_TARGET[shipmentStatus];
    const from = FULFILMENT_FLOW.indexOf(order.status);
    // 已退款或取消的訂單不再隨物流推進
    if (!target || from === -1) return;
    let current = order;
    for (const status of FULFILMENT_FLOW.slice(from + 1, FULFILMENT_FLOW.indexOf(target) + 1)) {
      await this.orders.applyTransition(
        tx,
        current,
        status,
        { type: 'SYSTEM' },
        FLOW_MESSAGE[status],
      );
      current = { ...current, status };
    }
  }
}

function mapKey(token: string): string {
  return `cvsmap:${token}`;
}

function providerLabel(provider: IntegrationProvider): string {
  return provider === 'ECPAY' ? '綠界物流' : '模擬物流';
}
