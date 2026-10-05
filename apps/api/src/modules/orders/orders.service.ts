import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { APP_CONFIG, type AppConfig } from '../../config/config.module.js';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { toPublicUrl } from '../../common/http/media.js';
import { pageMeta, skipTake } from '../../common/http/pagination.dto.js';
import { type Locale, pickTranslation } from '../../common/i18n/locale.js';
import { Prisma, type ActorType, type OrderStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { RedisService } from '../../infra/redis/redis.service.js';
import { assertPurchasable, assertQuantityAllowed } from '../cart/cart.service.js';
import { computeAvailability } from '../catalog/availability.js';
import { InventoryService } from '../inventory/inventory.service.js';
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
  items: { orderBy: { id: 'asc' } },
  payments: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.OrderInclude;

export type OrderWithDetail = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

export interface Actor {
  type: ActorType;
  id?: string;
}

type Tx = Prisma.TransactionClient;

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
    private readonly redis: RedisService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * 結帳：建立訂單並在同一個交易內扣庫存。
   * - 同一會員的結帳以 advisory lock 排隊，限購檢查不會被並發請求繞過
   * - 扣庫存是條件式 UPDATE，任何一件不足整筆回滾，不會出現「部分成立」的訂單
   * - 未付款訂單保留庫存到付款期限，逾期由排程釋放
   */
  async checkout(memberId: string, dto: CheckoutDto, fallbackLocale: Locale): Promise<OrderDto> {
    const locale = dto.locale ?? fallbackLocale;
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member || member.status !== 'ACTIVE') {
      throw AppException.unauthorized(ErrorCode.ACCOUNT_DISABLED, '帳號已停用或不存在');
    }

    const fromCart = !dto.items;
    const requested = mergeItems(dto.items ?? (await this.cartItems(memberId)));
    if (requested.length === 0) {
      throw AppException.badRequest(ErrorCode.CART_EMPTY, '購物車是空的');
    }

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
          const purchased = await purchasedQuantities(tx, memberId, ids);

          const now = new Date();
          const lines = requested.map(({ productId, quantity }) => {
            const product = byId.get(productId);
            if (!product || product.status !== 'ACTIVE') {
              throw AppException.notFound(ErrorCode.PRODUCT_NOT_FOUND, '購物車中有商品已下架');
            }
            assertPurchasable(computeAvailability(product, now));
            assertQuantityAllowed(product, purchased.get(productId) ?? 0, quantity);
            return {
              product,
              quantity,
              name: pickTranslation(product.translations, locale)?.name ?? product.sku,
              lineTotal: product.price * quantity,
            };
          });

          const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
          const shippingFee = calculateShippingFee(dto.shippingMethod, subtotal);
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

          for (const line of lines) {
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

          if (fromCart) {
            await tx.cartItem.deleteMany({ where: { cart: { memberId }, productId: { in: ids } } });
          }
          return created;
        },
        { timeout: 15_000 },
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
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) throw AppException.notFound(ErrorCode.ORDER_NOT_FOUND, '找不到這筆訂單');
      await this.applyTransition(tx, order, to, actor, message);
    });
  }

  async applyTransition(
    tx: Tx,
    order: Prisma.OrderGetPayload<{ include: { items: true } }>,
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
      for (const item of order.items) {
        await this.inventory.increment(tx, item.productId, item.quantity, {
          reason,
          orderId: order.id,
          actorId: actor.id,
        });
      }
    }

    const wasSpent = SPENT_STATUSES.includes(from);
    const isSpent = SPENT_STATUSES.includes(to);
    if (wasSpent !== isSpent) {
      await tx.member.update({
        where: { id: order.memberId },
        data: { totalSpent: { increment: isSpent ? order.total : -order.total } },
      });
    }

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

function mergeItems(items: { productId: string; quantity: number }[]) {
  const merged = new Map<string, number>();
  for (const item of items)
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
  return [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}
