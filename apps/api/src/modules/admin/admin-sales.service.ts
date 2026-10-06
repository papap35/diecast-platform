import { Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { pageMeta, skipTake } from '../../common/http/pagination.dto.js';
import { pickTranslation } from '../../common/i18n/locale.js';
import type { OrderStatus, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { LOW_STOCK_THRESHOLD } from '../catalog/availability.js';
import { TokenService } from '../auth/token.service.js';
import { nextStatuses, SPENT_STATUSES } from '../orders/order-rules.js';
import { MAX_INVOICE_ATTEMPTS } from '../invoices/invoices.service.js';
import { canCreateShipment } from '../logistics/logistics.service.js';
import { orderDetailInclude, OrdersService } from '../orders/orders.service.js';
import type {
  AdminMemberDto,
  AdminMemberListDto,
  AdminMemberQueryDto,
} from './dto/admin-members.dto.js';
import type {
  AdminOrderDto,
  AdminOrderListDto,
  AdminOrderListItemDto,
  AdminOrderQueryDto,
} from './dto/admin-orders.dto.js';
import type { DashboardDto, SalesPointDto } from './dto/dashboard.dto.js';

const listInclude = {
  member: { select: { email: true } },
  items: { select: { quantity: true } },
} satisfies Prisma.OrderInclude;

type OrderForList = Prisma.OrderGetPayload<{ include: typeof listInclude }>;

/** 台灣時間的當日 00:00（以 UTC Date 表示） */
export function startOfTaipeiDay(date: Date): Date {
  const taipei = new Date(date.getTime() + 8 * 3_600_000);
  taipei.setUTCHours(0, 0, 0, 0);
  return new Date(taipei.getTime() - 8 * 3_600_000);
}

@Injectable()
export class AdminSalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly tokens: TokenService,
  ) {}

  // ── 訂單 ──

  async listOrders(query: AdminOrderQueryDto): Promise<AdminOrderListDto> {
    const and: Prisma.OrderWhereInput[] = [];
    if (query.status) and.push({ status: query.status });
    if (query.from) and.push({ createdAt: { gte: query.from } });
    if (query.to) and.push({ createdAt: { lt: query.to } });
    if (query.q?.trim()) {
      const q = query.q.trim();
      and.push({
        OR: [
          { orderNo: { contains: q, mode: 'insensitive' } },
          { recipientName: { contains: q, mode: 'insensitive' } },
          { recipientPhone: { contains: q } },
          { member: { email: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }
    const where: Prisma.OrderWhereInput = { AND: and };
    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: listInclude,
        orderBy: { createdAt: 'desc' },
        ...skipTake(query),
      }),
    ]);
    return { data: orders.map(toListItem), meta: pageMeta(query.page, query.pageSize, total) };
  }

  async getOrder(id: string): Promise<AdminOrderDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        ...orderDetailInclude,
        member: { select: { id: true, email: true, name: true, phone: true } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order) throw AppException.notFound(ErrorCode.ORDER_NOT_FOUND, '找不到這筆訂單');
    const base = this.orders.toDto(order);
    return {
      ...base,
      shipment:
        base.shipment && order.shipment
          ? {
              ...base.shipment,
              merchantTradeNo: order.shipment.merchantTradeNo,
              logisticsId: order.shipment.logisticsId,
              statusCode: order.shipment.statusCode,
            }
          : null,
      invoice:
        base.invoice && order.invoice
          ? {
              ...base.invoice,
              provider: order.invoice.provider,
              attempts: order.invoice.attempts,
              nextAttemptAt: order.invoice.nextAttemptAt,
              lastError: order.invoice.lastError,
              needsAttention:
                (order.invoice.status === 'PENDING' || order.invoice.status === 'VOID_PENDING') &&
                order.invoice.attempts >= MAX_INVOICE_ATTEMPTS,
            }
          : null,
      member: order.member,
      events: order.events.map((event) => ({
        id: event.id,
        type: event.type,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        actorType: event.actorType,
        actorId: event.actorId,
        message: event.message,
        createdAt: event.createdAt,
      })),
      nextStatuses: nextStatuses(order.status).filter((status) => status !== 'PAID'),
      canCreateShipment: canCreateShipment(order.status, order.shipment?.status),
    };
  }

  /** 後台變更訂單狀態（不允許手動改成「已付款」，付款只能由金流回呼確認） */
  async updateOrderStatus(
    id: string,
    status: OrderStatus,
    adminId: string,
    note?: string,
  ): Promise<AdminOrderDto> {
    if (status === 'PAID') {
      throw AppException.badRequest(
        ErrorCode.INVALID_STATUS_TRANSITION,
        '付款狀態只能由金流通知更新',
      );
    }
    await this.orders.transition(id, status, { type: 'ADMIN', id: adminId }, note);
    return this.getOrder(id);
  }

  async addOrderNote(id: string, message: string, adminId: string): Promise<AdminOrderDto> {
    await this.prisma.orderEvent.create({
      data: { orderId: id, type: 'NOTE', actorType: 'ADMIN', actorId: adminId, message },
    });
    return this.getOrder(id);
  }

  // ── 會員 ──

  async listMembers(query: AdminMemberQueryDto): Promise<AdminMemberListDto> {
    const and: Prisma.MemberWhereInput[] = [];
    if (query.status) and.push({ status: query.status });
    if (query.tier) and.push({ tier: query.tier });
    if (query.q?.trim()) {
      const q = query.q.trim();
      and.push({
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
        ],
      });
    }
    const where: Prisma.MemberWhereInput = { AND: and };
    const [total, members] = await this.prisma.$transaction([
      this.prisma.member.count({ where }),
      this.prisma.member.findMany({
        where,
        include: { _count: { select: { orders: true } } },
        orderBy: { createdAt: 'desc' },
        ...skipTake(query),
      }),
    ]);
    return {
      data: members.map((member) => ({
        id: member.id,
        email: member.email,
        name: member.name,
        phone: member.phone,
        status: member.status,
        tier: member.tier,
        totalSpent: member.totalSpent,
        orderCount: member._count.orders,
        lastLoginAt: member.lastLoginAt,
        createdAt: member.createdAt,
      })),
      meta: pageMeta(query.page, query.pageSize, total),
    };
  }

  async getMember(id: string): Promise<AdminMemberDto> {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: {
        _count: { select: { orders: true } },
        orders: { include: listInclude, orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!member) throw AppException.notFound(ErrorCode.NOT_FOUND, '找不到這位會員');
    return {
      id: member.id,
      email: member.email,
      name: member.name,
      phone: member.phone,
      status: member.status,
      tier: member.tier,
      totalSpent: member.totalSpent,
      orderCount: member._count.orders,
      lastLoginAt: member.lastLoginAt,
      createdAt: member.createdAt,
      locale: member.locale,
      marketingOptIn: member.marketingOptIn,
      recentOrders: member.orders.map((order) =>
        toListItem({ ...order, member: { email: member.email } }),
      ),
    };
  }

  async updateMemberStatus(id: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<AdminMemberDto> {
    const member = await this.prisma.member.findUnique({ where: { id }, select: { status: true } });
    if (!member) throw AppException.notFound(ErrorCode.NOT_FOUND, '找不到這位會員');
    if (member.status === 'DELETED') {
      throw AppException.conflict(ErrorCode.CONFLICT, '已刪除的帳號無法變更狀態');
    }
    await this.prisma.member.update({ where: { id }, data: { status } });
    if (status === 'SUSPENDED') await this.tokens.revokeAll('MEMBER', id);
    return this.getMember(id);
  }

  // ── 儀表板 ──

  async dashboard(now: Date = new Date()): Promise<DashboardDto> {
    const todayStart = startOfTaipeiDay(now);
    const since30 = new Date(todayStart.getTime() - 29 * 86_400_000);
    const since14 = new Date(todayStart.getTime() - 13 * 86_400_000);
    const spent = { status: { in: SPENT_STATUSES } } satisfies Prisma.OrderWhereInput;

    const [today, last30, pendingPaymentCount, toShipCount, newMembers30d, totalMembers] =
      await Promise.all([
        this.prisma.order.aggregate({
          where: { ...spent, paidAt: { gte: todayStart } },
          _sum: { total: true },
          _count: true,
        }),
        this.prisma.order.aggregate({
          where: { ...spent, paidAt: { gte: since30 } },
          _sum: { total: true },
          _count: true,
        }),
        this.prisma.order.count({ where: { status: 'PENDING_PAYMENT' } }),
        this.prisma.order.count({ where: { status: { in: ['PAID', 'PROCESSING'] } } }),
        this.prisma.member.count({
          where: { createdAt: { gte: since30 }, status: { not: 'DELETED' } },
        }),
        this.prisma.member.count({ where: { status: { not: 'DELETED' } } }),
      ]);

    const [trendRows, topRows, lowStock, upcoming, recent] = await Promise.all([
      this.prisma.$queryRaw<{ day: string; revenue: number; orders: number }[]>`
        SELECT to_char(("paidAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Taipei')::date, 'YYYY-MM-DD') AS day,
               COALESCE(SUM("total"), 0)::int AS revenue,
               COUNT(*)::int AS orders
        FROM "Order"
        WHERE "status"::text IN ('PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED') AND "paidAt" >= ${since14}
        GROUP BY day ORDER BY day`,
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { ...spent, paidAt: { gte: since30 } } },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      this.prisma.product.findMany({
        where: { status: 'ACTIVE', stock: { lte: LOW_STOCK_THRESHOLD } },
        include: { translations: true },
        orderBy: [{ stock: 'asc' }, { updatedAt: 'desc' }],
        take: 6,
      }),
      this.prisma.product.findMany({
        where: { status: 'ACTIVE', releaseAt: { gt: now } },
        include: { translations: true },
        orderBy: { releaseAt: 'asc' },
        take: 5,
      }),
      this.prisma.order.findMany({ include: listInclude, orderBy: { createdAt: 'desc' }, take: 6 }),
    ]);

    const topProducts = await this.prisma.product.findMany({
      where: { id: { in: topRows.map((row) => row.productId) } },
      include: { translations: true },
    });
    const productName = new Map(
      topProducts.map((p) => [
        p.id,
        { name: pickTranslation(p.translations, 'zh-TW')?.name ?? p.sku, sku: p.sku },
      ]),
    );

    const revenue30d = last30._sum.total ?? 0;
    return {
      kpis: {
        todayRevenue: today._sum.total ?? 0,
        todayOrders: today._count,
        revenue30d,
        orders30d: last30._count,
        averageOrderValue30d: last30._count ? Math.round(revenue30d / last30._count) : 0,
        pendingPaymentCount,
        toShipCount,
        newMembers30d,
        totalMembers,
      },
      salesTrend: fillDays(since14, 14, trendRows),
      topProducts: topRows.map((row) => ({
        productId: row.productId,
        name: productName.get(row.productId)?.name ?? '',
        sku: productName.get(row.productId)?.sku ?? '',
        quantity: row._sum.quantity ?? 0,
        revenue: row._sum.lineTotal ?? 0,
      })),
      lowStock: lowStock.map((p) => ({
        id: p.id,
        name: pickTranslation(p.translations, 'zh-TW')?.name ?? p.sku,
        sku: p.sku,
        stock: p.stock,
      })),
      upcomingReleases: upcoming.map((p) => ({
        id: p.id,
        name: pickTranslation(p.translations, 'zh-TW')?.name ?? p.sku,
        saleType: p.saleType,
        releaseAt: p.releaseAt!,
        stock: p.stock,
      })),
      recentOrders: recent.map(toListItem),
    };
  }
}

function toListItem(order: OrderForList): AdminOrderListItemDto {
  return {
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    total: order.total,
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    memberEmail: order.member.email,
    recipientName: order.recipientName,
    shippingMethod: order.shippingMethod,
    paidAt: order.paidAt,
    createdAt: order.createdAt,
  };
}

/** 補齊沒有訂單的日期，圖表才不會斷線 */
export function fillDays(
  start: Date,
  days: number,
  rows: { day: string; revenue: number; orders: number }[],
): SalesPointDto[] {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  return Array.from({ length: days }, (_, i) => {
    const taipei = new Date(start.getTime() + i * 86_400_000 + 8 * 3_600_000);
    const date = taipei.toISOString().slice(0, 10);
    const row = byDay.get(date);
    return { date, revenue: row?.revenue ?? 0, orders: row?.orders ?? 0 };
  });
}
