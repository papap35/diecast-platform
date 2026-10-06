import { Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { taipeiDate, toTaipeiDay } from '../../common/time/taipei.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  MemberTier,
  type OrderStatus,
  SaleType,
  ShippingMethod,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { SPENT_STATUSES } from '../orders/order-rules.js';
import { csvRow, toCsv } from './csv.js';
import type {
  Granularity,
  OrdersExportQueryDto,
  ReportBreakdownDto,
  ReportCouponDto,
  ReportPointDto,
  ReportProductDto,
  ReportRangeQueryDto,
  ReportTotalsDto,
  SalesReportDto,
  SalesReportQueryDto,
} from './dto/report.dto.js';

const DAY_MS = 86_400_000;
/** 預設期間：含今天共 30 天 */
const DEFAULT_DAYS = 30;
/** 趨勢圖最多約 60～370 個點，太長的期間請改用較大的時間單位 */
const MAX_DAYS: Record<Granularity, number> = { day: 366, week: 3 * 366, month: 5 * 366 };
const MAX_EXPORT_DAYS = 5 * 366;
const EXPORT_BATCH = 1_000;

/** 報表與匯出都用台北日期當作期間：起日 00:00（含）到迄日隔天 00:00（不含） */
export interface ReportPeriod {
  from: string;
  to: string;
  gte: Date;
  lt: Date;
  days: number;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: '待付款',
  PAID: '已付款',
  PROCESSING: '備貨中',
  SHIPPED: '已出貨',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REFUNDED: '已退款',
};

const SHIPPING_LABELS: Record<ShippingMethod, string> = {
  HOME_DELIVERY: '宅配',
  CVS_711: '7-ELEVEN',
  CVS_FAMILY: '全家',
  CVS_HILIFE: '萊爾富',
  CVS_OKMART: 'OK 超商',
};

const SALE_TYPE_LABELS: Record<SaleType, string> = {
  REGULAR: '現貨',
  PRE_ORDER: '預購',
  LIMITED: '限量',
};

const ORDER_COLUMNS = [
  '訂單編號',
  '下單時間',
  '付款時間',
  '狀態',
  '會員 Email',
  '收件人',
  '配送方式',
  '件數',
  '商品小計',
  '優惠折抵',
  '運費',
  '訂單金額',
  '優惠碼',
  '發票號碼',
];

const PRODUCT_COLUMNS = [
  'SKU',
  '商品名稱',
  '品牌',
  '分類',
  '銷售型態',
  '售出件數',
  '商品金額',
  '優惠折抵',
  '商品實收',
  '目前庫存',
];

interface TotalsRow {
  orders: number;
  revenue: number;
  shippingFee: number;
  customers: number;
  units: number;
  discount: number;
  refundOrders: number;
  refundAmount: number;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async salesReport(query: SalesReportQueryDto, now: Date = new Date()): Promise<SalesReportDto> {
    const granularity = query.granularity ?? 'day';
    const period = resolvePeriod(query, MAX_DAYS[granularity], now);
    const previous = shiftPeriod(period, -period.days);
    const paid = paidWithin(period);

    const [
      totals,
      previousTotals,
      trendRows,
      byBrand,
      byCategory,
      saleTypeRows,
      shippingRows,
      tierMembers,
      tierRows,
      topProducts,
      coupons,
    ] = await Promise.all([
      this.totals(period),
      this.totals(previous),
      this.prisma.$queryRaw<{ date: string; revenue: number; orders: number }[]>`
        SELECT to_char(date_trunc(${granularity}, o."paidAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Taipei'), 'YYYY-MM-DD') AS date,
               SUM(o."total")::int AS revenue,
               COUNT(*)::int AS orders
        FROM "Order" o
        WHERE ${paid}
        GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<ReportBreakdownDto[]>`
        SELECT b."id"::text AS key, b."name" AS label,
               SUM(oi."lineTotal" - oi."discount")::int AS revenue,
               SUM(oi."quantity")::int AS units
        FROM "OrderItem" oi
        JOIN "Order" o ON o."id" = oi."orderId"
        JOIN "Product" p ON p."id" = oi."productId"
        JOIN "Brand" b ON b."id" = p."brandId"
        WHERE ${paid}
        GROUP BY b."id"
        ORDER BY revenue DESC, label`,
      this.prisma.$queryRaw<ReportBreakdownDto[]>`
        SELECT top."id"::text AS key, COALESCE(ct."name", top."slug") AS label,
               SUM(oi."lineTotal" - oi."discount")::int AS revenue,
               SUM(oi."quantity")::int AS units
        FROM "OrderItem" oi
        JOIN "Order" o ON o."id" = oi."orderId"
        JOIN "Product" p ON p."id" = oi."productId"
        JOIN "Category" c ON c."id" = p."categoryId"
        JOIN "Category" top ON top."id" = COALESCE(c."parentId", c."id")
        LEFT JOIN "CategoryTranslation" ct ON ct."categoryId" = top."id" AND ct."locale" = 'zh-TW'
        WHERE ${paid}
        GROUP BY top."id", ct."name"
        ORDER BY revenue DESC, label`,
      this.prisma.$queryRaw<{ saleType: SaleType; revenue: number; units: number }[]>`
        SELECT oi."saleType"::text AS "saleType",
               SUM(oi."lineTotal" - oi."discount")::int AS revenue,
               SUM(oi."quantity")::int AS units
        FROM "OrderItem" oi
        JOIN "Order" o ON o."id" = oi."orderId"
        WHERE ${paid}
        GROUP BY 1`,
      this.prisma.$queryRaw<{ method: ShippingMethod; orders: number; revenue: number }[]>`
        SELECT o."shippingMethod"::text AS method, COUNT(*)::int AS orders, SUM(o."total")::int AS revenue
        FROM "Order" o
        WHERE ${paid}
        GROUP BY 1`,
      this.prisma.member.groupBy({
        by: ['tier'],
        where: { status: { not: 'DELETED' } },
        _count: true,
      }),
      this.prisma.$queryRaw<{ tier: MemberTier; customers: number; revenue: number }[]>`
        SELECT m."tier"::text AS tier, COUNT(DISTINCT o."memberId")::int AS customers,
               SUM(o."total")::int AS revenue
        FROM "Order" o
        JOIN "Member" m ON m."id" = o."memberId"
        WHERE ${paid}
        GROUP BY 1`,
      this.prisma.$queryRaw<ReportProductDto[]>`
        SELECT p."id"::text AS "productId", p."sku" AS sku, COALESCE(pt."name", MAX(oi."name")) AS name,
               SUM(oi."lineTotal" - oi."discount")::int AS revenue,
               SUM(oi."quantity")::int AS units
        FROM "OrderItem" oi
        JOIN "Order" o ON o."id" = oi."orderId"
        JOIN "Product" p ON p."id" = oi."productId"
        LEFT JOIN "ProductTranslation" pt ON pt."productId" = p."id" AND pt."locale" = 'zh-TW'
        WHERE ${paid}
        GROUP BY p."id", pt."name"
        ORDER BY revenue DESC, units DESC, sku
        LIMIT 10`,
      this.prisma.$queryRaw<ReportCouponDto[]>`
        SELECT c."id"::text AS "couponId", c."code" AS code, c."name" AS name,
               COUNT(*)::int AS orders, SUM(r."amount")::int AS discount, SUM(o."total")::int AS revenue
        FROM "CouponRedemption" r
        JOIN "Order" o ON o."id" = r."orderId"
        JOIN "Coupon" c ON c."id" = r."couponId"
        WHERE ${paid}
        GROUP BY c."id"
        ORDER BY orders DESC, discount DESC, code
        LIMIT 20`,
    ]);

    const saleTypes = new Map(saleTypeRows.map((row) => [row.saleType, row]));
    const shipping = new Map(shippingRows.map((row) => [row.method, row]));
    const members = new Map(tierMembers.map((row) => [row.tier, row._count]));
    const tiers = new Map(tierRows.map((row) => [row.tier, row]));
    return {
      from: period.from,
      to: period.to,
      granularity,
      totals,
      previous: previousTotals,
      previousFrom: previous.from,
      previousTo: previous.to,
      trend: fillPeriods(period, granularity, trendRows),
      byBrand,
      byCategory,
      bySaleType: Object.values(SaleType).map((saleType) => ({
        saleType,
        revenue: saleTypes.get(saleType)?.revenue ?? 0,
        units: saleTypes.get(saleType)?.units ?? 0,
      })),
      byShipping: Object.values(ShippingMethod).map((method) => ({
        method,
        orders: shipping.get(method)?.orders ?? 0,
        revenue: shipping.get(method)?.revenue ?? 0,
      })),
      byTier: Object.values(MemberTier).map((tier) => ({
        tier,
        members: members.get(tier) ?? 0,
        customers: tiers.get(tier)?.customers ?? 0,
        revenue: tiers.get(tier)?.revenue ?? 0,
      })),
      topProducts,
      coupons,
    };
  }

  /** 商品銷售 CSV：期間內付款的訂單，依商品加總（商品數量有限，一次產生） */
  async productsCsv(query: ReportRangeQueryDto, now: Date = new Date()) {
    const period = resolvePeriod(query, MAX_EXPORT_DAYS, now);
    const rows = await this.prisma.$queryRaw<
      {
        sku: string;
        name: string;
        brand: string;
        category: string;
        saleType: SaleType;
        units: number;
        gross: number;
        discount: number;
        stock: number;
      }[]
    >`
      SELECT p."sku" AS sku, COALESCE(pt."name", MAX(oi."name")) AS name, b."name" AS brand,
             COALESCE(ct."name", c."slug") AS category, p."saleType"::text AS "saleType",
             SUM(oi."quantity")::int AS units, SUM(oi."lineTotal")::int AS gross,
             SUM(oi."discount")::int AS discount, p."stock" AS stock
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      JOIN "Product" p ON p."id" = oi."productId"
      JOIN "Brand" b ON b."id" = p."brandId"
      JOIN "Category" c ON c."id" = p."categoryId"
      LEFT JOIN "ProductTranslation" pt ON pt."productId" = p."id" AND pt."locale" = 'zh-TW'
      LEFT JOIN "CategoryTranslation" ct ON ct."categoryId" = c."id" AND ct."locale" = 'zh-TW'
      WHERE ${paidWithin(period)}
      GROUP BY p."id", pt."name", b."name", ct."name", c."slug"
      ORDER BY SUM(oi."lineTotal" - oi."discount") DESC, p."sku"`;
    return {
      filename: `products_${period.from}_${period.to}.csv`,
      content: toCsv(
        PRODUCT_COLUMNS,
        rows.map((row) => [
          row.sku,
          row.name,
          row.brand,
          row.category,
          SALE_TYPE_LABELS[row.saleType],
          row.units,
          row.gross,
          row.discount,
          row.gross - row.discount,
          row.stock,
        ]),
      ),
    };
  }

  /** 訂單明細 CSV 的檔名與期間（先驗證參數，錯誤才能以 JSON 回應） */
  ordersExport(query: OrdersExportQueryDto, now: Date = new Date()) {
    const period = resolvePeriod(query, MAX_EXPORT_DAYS, now);
    const suffix = query.status ? `_${query.status.toLowerCase()}` : '';
    return { period, filename: `orders_${period.from}_${period.to}${suffix}.csv` };
  }

  /** 依下單時間分批讀取並逐列輸出，大量訂單也不會一次載入記憶體 */
  async *ordersCsv(period: ReportPeriod, status?: OrderStatus): AsyncGenerator<string> {
    yield `﻿${csvRow(ORDER_COLUMNS)}\r\n`;
    const where: Prisma.OrderWhereInput = {
      createdAt: { gte: period.gte, lt: period.lt },
      ...(status ? { status } : {}),
    };
    let cursor: string | undefined;
    for (;;) {
      const batch = await this.prisma.order.findMany({
        where,
        include: {
          member: { select: { email: true } },
          items: { select: { quantity: true } },
          invoice: { select: { invoiceNo: true } },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: EXPORT_BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (!batch.length) return;
      yield batch
        .map(
          (order) =>
            `${csvRow([
              order.orderNo,
              taipeiDateTime(order.createdAt),
              order.paidAt ? taipeiDateTime(order.paidAt) : '',
              STATUS_LABELS[order.status],
              order.member.email,
              order.recipientName,
              SHIPPING_LABELS[order.shippingMethod],
              order.items.reduce((sum, item) => sum + item.quantity, 0),
              order.subtotal,
              order.discountTotal,
              order.shippingFee,
              order.total,
              order.couponCode,
              order.invoice?.invoiceNo,
            ])}\r\n`,
        )
        .join('');
      if (batch.length < EXPORT_BATCH) return;
      cursor = batch[batch.length - 1]!.id;
    }
  }

  private async totals(period: ReportPeriod): Promise<ReportTotalsDto> {
    const paid = paidWithin(period);
    const [[row], newMembers] = await Promise.all([
      this.prisma.$queryRaw<TotalsRow[]>`
        WITH paid AS (
          SELECT o."id", o."memberId", o."total", o."shippingFee" FROM "Order" o WHERE ${paid}
        ),
        refunded AS (
          SELECT o."total" FROM "Order" o
          WHERE o."status" = 'REFUNDED'
            AND EXISTS (
              SELECT 1 FROM "OrderEvent" e
              WHERE e."orderId" = o."id" AND e."toStatus" = 'REFUNDED'
                AND e."createdAt" >= ${period.gte} AND e."createdAt" < ${period.lt}
            )
        )
        SELECT
          (SELECT COUNT(*) FROM paid)::int AS orders,
          (SELECT COALESCE(SUM("total"), 0) FROM paid)::int AS revenue,
          (SELECT COALESCE(SUM("shippingFee"), 0) FROM paid)::int AS "shippingFee",
          (SELECT COUNT(DISTINCT "memberId") FROM paid)::int AS customers,
          (SELECT COALESCE(SUM(oi."quantity"), 0) FROM "OrderItem" oi JOIN paid ON paid."id" = oi."orderId")::int AS units,
          (SELECT COALESCE(SUM(r."amount"), 0) FROM "CouponRedemption" r JOIN paid ON paid."id" = r."orderId")::int AS discount,
          (SELECT COUNT(*) FROM refunded)::int AS "refundOrders",
          (SELECT COALESCE(SUM("total"), 0) FROM refunded)::int AS "refundAmount"`,
      this.prisma.member.count({
        where: { createdAt: { gte: period.gte, lt: period.lt }, status: { not: 'DELETED' } },
      }),
    ]);
    const totals = row!;
    return {
      ...totals,
      averageOrderValue: totals.orders ? Math.round(totals.revenue / totals.orders) : 0,
      newMembers,
    };
  }
}

/** 期間內付款、目前仍計入營收的訂單（退款後不再計入） */
function paidWithin(period: ReportPeriod): Prisma.Sql {
  return Prisma.sql`o."status"::text IN (${Prisma.join(SPENT_STATUSES)})
    AND o."paidAt" >= ${period.gte} AND o."paidAt" < ${period.lt}`;
}

/** 解析期間參數：預設最近 30 天，起日不可晚於迄日，也不可超過上限天數 */
export function resolvePeriod(
  query: ReportRangeQueryDto,
  maxDays: number,
  now: Date = new Date(),
): ReportPeriod {
  const to = query.to ?? toTaipeiDay(now);
  const from =
    query.from ?? toTaipeiDay(new Date(taipeiDate(to).getTime() - (DEFAULT_DAYS - 1) * DAY_MS));
  const gte = taipeiDate(from);
  const lt = new Date(taipeiDate(to).getTime() + DAY_MS);
  const days = Math.round((lt.getTime() - gte.getTime()) / DAY_MS);
  if (days < 1) throw invalidRange('to', '迄日不可早於起日');
  if (days > maxDays)
    throw invalidRange('from', `期間最長 ${maxDays} 天，請縮短期間或改用較大的時間單位`);
  return { from, to, gte, lt, days };
}

function shiftPeriod(period: ReportPeriod, days: number): ReportPeriod {
  const gte = new Date(period.gte.getTime() + days * DAY_MS);
  const lt = new Date(period.lt.getTime() + days * DAY_MS);
  return {
    from: toTaipeiDay(gte),
    to: toTaipeiDay(new Date(lt.getTime() - DAY_MS)),
    gte,
    lt,
    days: period.days,
  };
}

function invalidRange(field: string, message: string): AppException {
  return AppException.badRequest(ErrorCode.VALIDATION_FAILED, message, [
    { field, messages: [message] },
  ]);
}

/** 補齊沒有訂單的時段（週從週一、月從 1 日起算，與 PostgreSQL date_trunc 相同） */
export function fillPeriods(
  period: Pick<ReportPeriod, 'from' | 'to'>,
  granularity: Granularity,
  rows: ReportPointDto[],
): ReportPointDto[] {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const points: ReportPointDto[] = [];
  for (let date = truncate(period.from, granularity); date <= period.to;) {
    const row = byDate.get(date);
    points.push({ date, revenue: row?.revenue ?? 0, orders: row?.orders ?? 0 });
    date = advance(date, granularity);
  }
  return points;
}

function truncate(day: string, granularity: Granularity): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (granularity === 'week') date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  if (granularity === 'month') date.setUTCDate(1);
  return date.toISOString().slice(0, 10);
}

function advance(day: string, granularity: Granularity): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (granularity === 'day') date.setUTCDate(date.getUTCDate() + 1);
  else if (granularity === 'week') date.setUTCDate(date.getUTCDate() + 7);
  else date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

/** 台北時間 YYYY-MM-DD HH:mm（試算表可直接辨識為日期時間） */
export function taipeiDateTime(date: Date): string {
  return new Date(date.getTime() + 8 * 3_600_000).toISOString().slice(0, 16).replace('T', ' ');
}
