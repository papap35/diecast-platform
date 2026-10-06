import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { APP_CONFIG, type AppConfig } from '../../config/config.module.js';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { toPublicUrl } from '../../common/http/media.js';
import { pageMeta, skipTake } from '../../common/http/pagination.dto.js';
import { type Locale, pickTranslation } from '../../common/i18n/locale.js';
import {
  Prisma,
  type ActorType,
  type MemberTier,
  type NotificationType,
  type OrderStatus,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { consumeRateLimit } from '../../infra/redis/rate-limit.js';
import { RedisService } from '../../infra/redis/redis.service.js';
import { assertPurchasable, assertQuantityAllowed } from '../cart/cart.service.js';
import { computeAvailability } from '../catalog/availability.js';
import { parkOrderInGarage, removeOrderFromGarage } from '../garage/garage-lifecycle.js';
import { DropGateService } from '../inventory/drop-gate.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { queueInvoice, reverseInvoice } from '../invoices/invoice-lifecycle.js';
import { tierFor, tierRank } from '../members/tiers.js';
import type { NotificationParams } from '../notifications/notification-templates.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { CheckoutDto, OrderDto, OrderListDto, OrderListQueryDto } from './dto/order.dto.js';
import { generateOrderNo } from './order-number.js';
import {
  calculateShippingFee,
  canTransition,
  isConvenienceStore,
  releasesStock,
  SPENT_STATUSES,
} from './order-rules.js';
import { purchasedQuantities } from './purchase-history.js';

export const orderDetailInclude = {
  items: { orderBy: { id: 'asc' }, include: { product: { select: { expectedShipAt: true } } } },
  payments: { orderBy: { createdAt: 'desc' } },
  shipment: true,
  invoice: true,
} satisfies Prisma.OrderInclude;

export type OrderWithDetail = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

export interface Actor {
  type: ActorType;
  id?: string;
}

type Tx = Prisma.TransactionClient;
type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

/** 同一會員的結帳頻率上限（擋機器人連發；真人不會碰到） */
const CHECKOUT_RATE = { limit: 10, windowSeconds: 10 };

const STATUS_TIMESTAMP: Partial<Record<OrderStatus, keyof Prisma.OrderUpdateManyMutationInput>> = {
  PAID: 'paidAt',
  SHIPPED: 'shippedAt',
  COMPLETED: 'completedAt',
  CANCELLED: 'cancelledAt',
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly gate: DropGateService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * 結帳：建立訂單並在同一個交易內扣庫存。
   * - 限量商品先通過 Redis 閘門預扣名額，售完的請求不進資料庫（開賣瞬間的減壓）
   * - 同一會員的結帳以 advisory lock 排隊，限購檢查不會被並發請求繞過
   * - 扣庫存是條件式 UPDATE，任何一件不足整筆回滾，不會出現「部分成立」的訂單
   * - 未付款訂單保留庫存到付款期限，逾期由排程釋放
   */
  async checkout(memberId: string, dto: CheckoutDto, fallbackLocale: Locale): Promise<OrderDto> {
    const locale = dto.locale ?? fallbackLocale;
    const allowed = await consumeRateLimit(
      this.redis,
      `rl:checkout:${memberId}`,
      CHECKOUT_RATE.limit,
      CHECKOUT_RATE.windowSeconds,
    );
    if (!allowed) {
      throw new AppException(
        ErrorCode.RATE_LIMITED,
        '結帳太頻繁，請稍候再試',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const fromCart = !dto.items;
    const requested = mergeItems(dto.items ?? (await this.cartItems(memberId)));
    if (requested.length === 0) {
      throw AppException.badRequest(ErrorCode.CART_EMPTY, '購物車是空的');
    }

    // 開賣瞬間的快速路徑：售完的請求只經過 Redis 與記憶體快取就回應，不碰資料庫
    const saleTypes = await this.gate.saleTypes(requested.map((item) => item.productId));
    assertNotMixedPreorder([...saleTypes.values()]);
    const reserved = await this.reserveDropSlots(
      requested.filter((item) => saleTypes.get(item.productId) === 'LIMITED'),
    );

    try {
      const member = await this.prisma.member.findUnique({ where: { id: memberId } });
      if (!member || member.status !== 'ACTIVE') {
        throw AppException.unauthorized(ErrorCode.ACCOUNT_DISABLED, '帳號已停用或不存在');
      }
      return await this.placeOrder(member, requested, dto, locale, fromCart);
    } catch (error) {
      await Promise.all(reserved.map((item) => this.gate.release(item.productId, item.quantity)));
      throw error;
    }
  }

  /** 限量商品通過閘門才進資料庫；任何一件名額不足就歸還已預扣的並回應售完 */
  private async reserveDropSlots(
    items: { productId: string; quantity: number }[],
  ): Promise<{ productId: string; quantity: number }[]> {
    const reserved: { productId: string; quantity: number }[] = [];
    for (const item of items) {
      if (await this.gate.reserve(item.productId, item.quantity)) {
        reserved.push(item);
        continue;
      }
      await Promise.all(reserved.map((r) => this.gate.release(r.productId, r.quantity)));
      throw AppException.conflict(ErrorCode.OUT_OF_STOCK, '限量商品已售完', {
        productId: item.productId,
        available: 0,
      });
    }
    return reserved;
  }

  private async placeOrder(
    member: { id: string; email: string; tier: MemberTier },
    requested: { productId: string; quantity: number }[],
    dto: CheckoutDto,
    locale: Locale,
    fromCart: boolean,
  ): Promise<OrderDto> {
    const { id: memberId, tier } = member;
    const order = await this.withOrderNoRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`checkout:${memberId}`}))`;

          const ids = requested.map((item) => item.productId);
          const products = await tx.product.findMany({
            where: { id: { in: ids } },
            include: { translations: true, images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
          });
          const byId = new Map(products.map((product) => [product.id, product]));
          // 以資料庫最新資料再檢查一次（交易外的檢查用的是快取）
          assertNotMixedPreorder(products.map((product) => product.saleType));
          const purchased = await purchasedQuantities(tx, memberId, ids);

          const now = new Date();
          const lines = requested.map(({ productId, quantity }) => {
            const product = byId.get(productId);
            if (!product || product.status !== 'ACTIVE') {
              throw AppException.notFound(ErrorCode.PRODUCT_NOT_FOUND, '購物車中有商品已下架');
            }
            assertPurchasable(computeAvailability(product, now, tier));
            assertQuantityAllowed(product, purchased.get(productId) ?? 0, quantity);
            return {
              product,
              quantity,
              name: pickTranslation(product.translations, locale)?.name ?? product.sku,
              lineTotal: product.price * quantity,
            };
          });

          const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
          const shippingFee = calculateShippingFee(dto.shippingMethod, subtotal, tier);
          const hasLimited = lines.some((line) => line.product.saleType === 'LIMITED');
          const timeoutMinutes = hasLimited
            ? this.config.LIMITED_PAYMENT_TIMEOUT_MINUTES
            : this.config.ORDER_PAYMENT_TIMEOUT_MINUTES;
          const cvs = isConvenienceStore(dto.shippingMethod);

          const created = await tx.order.create({
            data: {
              orderNo: generateOrderNo(now),
              memberId,
              locale,
              subtotal,
              shippingFee,
              total: subtotal + shippingFee,
              shippingMethod: dto.shippingMethod,
              recipientName: dto.recipientName.trim(),
              recipientPhone: dto.recipientPhone,
              recipientEmail: dto.recipientEmail ?? member.email,
              postalCode: cvs ? null : dto.postalCode,
              city: cvs ? null : dto.city,
              district: cvs ? null : dto.district,
              addressLine: cvs ? null : dto.addressLine,
              cvsStoreId: cvs ? dto.cvsStoreId : null,
              cvsStoreName: cvs ? dto.cvsStoreName : null,
              cvsStoreAddress: cvs ? dto.cvsStoreAddress : null,
              invoiceType: dto.invoiceType,
              invoiceCarrierNum: dto.invoiceCarrierNum ?? null,
              invoiceDonationCode: dto.invoiceDonationCode ?? null,
              invoiceTaxId: dto.invoiceTaxId ?? null,
              invoiceTitle: dto.invoiceTitle ?? null,
              note: dto.note?.trim() || null,
              paymentDeadline: new Date(now.getTime() + timeoutMinutes * 60_000),
              items: {
                create: lines.map((line) => ({
                  productId: line.product.id,
                  sku: line.product.sku,
                  name: line.name,
                  imageUrl: line.product.images[0]?.url ?? null,
                  saleType: line.product.saleType,
                  unitPrice: line.product.price,
                  quantity: line.quantity,
                  lineTotal: line.lineTotal,
                })),
              },
              events: {
                create: {
                  type: 'CREATED',
                  toStatus: 'PENDING_PAYMENT',
                  actorType: 'MEMBER',
                  actorId: memberId,
                  message: `訂單成立，請於 ${timeoutMinutes} 分鐘內完成付款`,
                },
              },
            },
            include: orderDetailInclude,
          });

          if (fromCart) {
            await tx.cartItem.deleteMany({ where: { cart: { memberId }, productId: { in: ids } } });
          }

          // 扣庫存放在交易最後：商品那一列從 UPDATE 鎖到 COMMIT，越晚上鎖，開賣時排隊的人等越短
          for (const line of inLockOrder(lines, (line) => line.product.id)) {
            const remaining = await this.inventory.decrement(tx, line.product.id, line.quantity, {
              reason: 'ORDER_PLACED',
              orderId: created.id,
              actorId: memberId,
            });
            if (remaining === null) {
              const current = await tx.product.findUnique({
                where: { id: line.product.id },
                select: { stock: true },
              });
              throw AppException.conflict(ErrorCode.OUT_OF_STOCK, `「${line.name}」庫存不足`, {
                productId: line.product.id,
                available: current?.stock ?? 0,
              });
            }
          }
          return created;
        },
        // 開賣尖峰時連線池可能排隊，等待連線的上限放寬到 10 秒（預設 2 秒會直接失敗）
        { timeout: 15_000, maxWait: 10_000 },
      ),
    );

    return this.toDto(order);
  }

  async listForMember(memberId: string, query: OrderListQueryDto): Promise<OrderListDto> {
    const where: Prisma.OrderWhereInput = {
      memberId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: { items: { orderBy: { id: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        ...skipTake(query),
      }),
    ]);
    return {
      data: orders.map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        status: order.status,
        total: order.total,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        firstItemName: order.items[0]?.name ?? '',
        firstItemImageUrl: order.items[0]?.imageUrl ? this.mediaUrl(order.items[0].imageUrl) : null,
        paymentDeadline: order.paymentDeadline,
        createdAt: order.createdAt,
      })),
      meta: pageMeta(query.page, query.pageSize, total),
    };
  }

  async getForMember(memberId: string, orderNo: string): Promise<OrderDto> {
    return this.toDto(await this.findMemberOrder(memberId, orderNo));
  }

  async findMemberOrder(memberId: string, orderNo: string): Promise<OrderWithDetail> {
    const order = await this.prisma.order.findUnique({
      where: { orderNo },
      include: orderDetailInclude,
    });
    if (!order || order.memberId !== memberId) {
      throw AppException.notFound(ErrorCode.ORDER_NOT_FOUND, '找不到這筆訂單');
    }
    return order;
  }

  /** 會員只能取消尚未付款的訂單；已付款的取消需由客服退款 */
  async cancelByMember(memberId: string, orderNo: string): Promise<OrderDto> {
    const order = await this.findMemberOrder(memberId, orderNo);
    if (order.status !== 'PENDING_PAYMENT') {
      throw AppException.conflict(
        ErrorCode.ORDER_NOT_CANCELLABLE,
        '訂單已付款，請聯繫客服辦理取消',
      );
    }
    await this.transition(order.id, 'CANCELLED', { type: 'MEMBER', id: memberId }, '會員取消訂單');
    return this.getForMember(memberId, orderNo);
  }

  /**
   * 訂單狀態變更的唯一入口：檢查狀態機、樂觀鎖（WHERE status = 原狀態）、
   * 必要時釋放庫存、調整會員累計消費，並寫入事件軌跡。
   */
  async transition(
    orderId: string,
    to: OrderStatus,
    actor: Actor,
    message?: string,
  ): Promise<void> {
    const order = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) throw AppException.notFound(ErrorCode.ORDER_NOT_FOUND, '找不到這筆訂單');
      await this.applyTransition(tx, order, to, actor, message);
      return order;
    });
    // 交易提交後才清掉限量閘門，下一個請求才會讀到已釋放的庫存
    if (releasesStock(order.status, to)) {
      await this.gate.invalidate(
        order.items.filter((item) => item.saleType === 'LIMITED').map((item) => item.productId),
      );
    }
  }

  async applyTransition(
    tx: Tx,
    order: OrderWithItems,
    to: OrderStatus,
    actor: Actor,
    message?: string,
  ): Promise<void> {
    const from = order.status;
    if (!canTransition(from, to)) {
      throw new AppException(
        ErrorCode.INVALID_STATUS_TRANSITION,
        `訂單狀態無法從 ${from} 變更為 ${to}`,
        HttpStatus.CONFLICT,
      );
    }

    const timestampField = STATUS_TIMESTAMP[to];
    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: from },
      data: {
        status: to,
        ...(timestampField ? { [timestampField]: new Date() } : {}),
        ...(to === 'CANCELLED' ? { cancelReason: message ?? null, paymentDeadline: null } : {}),
      },
    });
    if (count === 0) {
      throw AppException.conflict(ErrorCode.CONFLICT, '訂單狀態已被其他操作變更，請重新整理');
    }

    if (releasesStock(from, to)) {
      const reason =
        actor.type === 'SYSTEM' && to === 'CANCELLED' ? 'ORDER_EXPIRED' : 'ORDER_CANCELLED';
      for (const item of inLockOrder(order.items, (item) => item.productId)) {
        await this.inventory.increment(tx, item.productId, item.quantity, {
          reason,
          orderId: order.id,
          actorId: actor.id,
        });
      }
    }

    await this.applyEffects(tx, order, from, to, actor);

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: 'STATUS_CHANGED',
        fromStatus: from,
        toStatus: to,
        actorType: actor.type,
        actorId: actor.id,
        message,
      },
    });
  }

  /**
   * 狀態變更的連帶效果（與狀態變更同一個交易）：電子發票、會員累計消費與等級、
   * 車庫自動入庫、站內通知與 Email。
   */
  private async applyEffects(
    tx: Tx,
    order: OrderWithItems,
    from: OrderStatus,
    to: OrderStatus,
    actor: Actor,
  ): Promise<void> {
    if (to === 'PAID') {
      await queueInvoice(tx, order, this.config.INVOICE_PROVIDER === 'ecpay' ? 'ECPAY' : 'MOCK');
    }
    if (to === 'REFUNDED') await reverseInvoice(tx, order.id);

    const wasSpent = SPENT_STATUSES.includes(from);
    const isSpent = SPENT_STATUSES.includes(to);
    if (wasSpent !== isSpent) {
      const member = await tx.member.update({
        where: { id: order.memberId },
        data: { totalSpent: { increment: isSpent ? order.total : -order.total } },
        select: { totalSpent: true, tier: true },
      });
      await this.syncTier(tx, order.memberId, member);
    }

    if (to === 'COMPLETED') await parkOrderInGarage(tx, order);
    if (from === 'COMPLETED' && to === 'REFUNDED') await removeOrderFromGarage(tx, order);

    const link = `/account/orders/${order.orderNo}`;
    const notify = (type: NotificationType, params: NotificationParams = {}) =>
      this.notifications.notify(tx, {
        memberId: order.memberId,
        type,
        params: { orderNo: order.orderNo, ...params },
        link,
      });
    if (to === 'PAID') await notify('ORDER_PAID', { total: order.total });
    if (to === 'SHIPPED') await notify('ORDER_SHIPPED');
    if (to === 'REFUNDED') await notify('ORDER_REFUNDED', { total: order.total });
    // 會員自己取消的不需通知
    if (to === 'CANCELLED' && actor.type !== 'MEMBER') {
      await notify('ORDER_CANCELLED', { expired: actor.type === 'SYSTEM' });
    }
  }

  /** 累計消費變動後重新計算等級（升級時通知；退款扣回消費會降級） */
  private async syncTier(
    tx: Tx,
    memberId: string,
    member: { totalSpent: number; tier: MemberTier },
  ): Promise<void> {
    const tier = tierFor(member.totalSpent);
    if (tier === member.tier) return;
    await tx.member.update({ where: { id: memberId }, data: { tier, tierUpdatedAt: new Date() } });
    if (tierRank(tier) > tierRank(member.tier)) {
      await this.notifications.notify(tx, {
        memberId,
        type: 'TIER_UPGRADED',
        params: { tier },
        link: '/account',
      });
    }
  }

  /** 每分鐘取消逾期未付款的訂單並釋放庫存（多台機器部署時以 Redis 鎖確保只有一台執行） */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'expire-unpaid-orders' })
  async handleExpiryCron(): Promise<void> {
    if (this.config.NODE_ENV === 'test') return;
    const acquired = await this.redis
      .set('lock:expire-unpaid-orders', '1', 'EX', 50, 'NX')
      .catch(() => null);
    if (acquired !== 'OK') return;
    const count = await this.expireUnpaidOrders();
    if (count > 0) this.logger.log(`已取消 ${count} 筆逾期未付款訂單`);
  }

  async expireUnpaidOrders(now: Date = new Date()): Promise<number> {
    const expired = await this.prisma.order.findMany({
      where: { status: 'PENDING_PAYMENT', paymentDeadline: { lt: now } },
      select: { id: true },
      orderBy: { paymentDeadline: 'asc' },
      take: 200,
    });
    let cancelled = 0;
    for (const { id } of expired) {
      try {
        await this.transition(id, 'CANCELLED', { type: 'SYSTEM' }, '付款期限已過，系統自動取消');
        cancelled += 1;
      } catch (error) {
        // 可能剛好在這一刻完成付款，狀態已不是待付款，略過即可
        this.logger.warn(`訂單 ${id} 逾期取消略過：${(error as Error).message}`);
      }
    }
    return cancelled;
  }

  toDto(order: OrderWithDetail): OrderDto {
    const deadlinePassed = !!order.paymentDeadline && order.paymentDeadline <= new Date();
    return {
      id: order.id,
      orderNo: order.orderNo,
      status: order.status,
      locale: order.locale,
      currency: order.currency,
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      discountTotal: order.discountTotal,
      total: order.total,
      shippingMethod: order.shippingMethod,
      recipientName: order.recipientName,
      recipientPhone: order.recipientPhone,
      recipientEmail: order.recipientEmail,
      postalCode: order.postalCode,
      city: order.city,
      district: order.district,
      addressLine: order.addressLine,
      cvsStoreId: order.cvsStoreId,
      cvsStoreName: order.cvsStoreName,
      cvsStoreAddress: order.cvsStoreAddress,
      invoiceType: order.invoiceType,
      invoiceCarrierNum: order.invoiceCarrierNum,
      invoiceDonationCode: order.invoiceDonationCode,
      invoiceTaxId: order.invoiceTaxId,
      invoiceTitle: order.invoiceTitle,
      note: order.note,
      paymentDeadline: order.paymentDeadline,
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      completedAt: order.completedAt,
      cancelledAt: order.cancelledAt,
      cancelReason: order.cancelReason,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        imageUrl: item.imageUrl ? this.mediaUrl(item.imageUrl) : null,
        saleType: item.saleType,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      })),
      payments: order.payments.map((payment) => ({
        provider: payment.provider,
        status: payment.status,
        amount: payment.amount,
        method: payment.method,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
      })),
      shipment: order.shipment
        ? {
            provider: order.shipment.provider,
            status: order.shipment.status,
            logisticsSubType: order.shipment.logisticsSubType,
            shipmentNo: order.shipment.shipmentNo,
            validationNo: order.shipment.validationNo,
            statusMessage: order.shipment.statusMessage,
            createdAt: order.shipment.createdAt,
            updatedAt: order.shipment.updatedAt,
          }
        : null,
      invoice: order.invoice
        ? {
            status: order.invoice.status,
            invoiceNo: order.invoice.invoiceNo,
            invoiceDate: order.invoice.invoiceDate,
            randomNumber: order.invoice.randomNumber,
            allowanceNo: order.invoice.allowanceNo,
            amount: order.invoice.amount,
          }
        : null,
      expectedShipAt: expectedShipAt(order),
      canPay: order.status === 'PENDING_PAYMENT' && !deadlinePassed,
      canCancel: order.status === 'PENDING_PAYMENT',
    };
  }

  mediaUrl(url: string): string {
    return toPublicUrl(url, this.config.API_PUBLIC_URL);
  }

  private async cartItems(memberId: string) {
    return this.prisma.cartItem.findMany({
      where: { cart: { memberId } },
      select: { productId: true, quantity: true },
      orderBy: { addedAt: 'asc' },
    });
  }

  /** 訂單編號碰撞（機率極低）時整筆交易重試 */
  private async withOrderNoRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        const isOrderNoCollision =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          JSON.stringify(error.meta ?? {}).includes('orderNo');
        if (!isOrderNoCollision || attempt >= attempts) throw error;
      }
    }
  }
}

/** 預購商品需與現貨分開結帳（預購要等到貨才出貨） */
function assertNotMixedPreorder(saleTypes: (string | null)[]): void {
  const preorders = saleTypes.filter((saleType) => saleType === 'PRE_ORDER').length;
  if (preorders > 0 && preorders < saleTypes.length) {
    throw AppException.badRequest(ErrorCode.PREORDER_SEPARATE_CHECKOUT, '預購商品需與現貨分開結帳');
  }
}

/** 預購訂單的預計出貨時間：取各預購商品中最晚的一個 */
function expectedShipAt(order: OrderWithDetail): Date | null {
  const dates = order.items
    .filter((item) => item.saleType === 'PRE_ORDER' && item.product.expectedShipAt)
    .map((item) => item.product.expectedShipAt!.getTime());
  return dates.length ? new Date(Math.max(...dates)) : null;
}

/** 多件商品固定依 ID 順序上鎖：兩筆交易不會各握一件、互等對方（deadlock） */
function inLockOrder<T>(items: T[], productId: (item: T) => string): T[] {
  return [...items].sort((a, b) => {
    const [x, y] = [productId(a), productId(b)];
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

function mergeItems(items: { productId: string; quantity: number }[]) {
  const merged = new Map<string, number>();
  for (const item of items)
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
  return [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}
