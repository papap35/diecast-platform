import { ApiProperty } from '@nestjs/swagger';
import { SaleType } from '../../../generated/prisma/enums.js';
import { AdminOrderListItemDto } from './admin-orders.dto.js';

export class DashboardKpisDto {
  /** 今日（台灣時間）已付款營收 */
  todayRevenue!: number;
  todayOrders!: number;
  /** 近 30 天已付款營收 */
  revenue30d!: number;
  orders30d!: number;
  /** 平均客單價（近 30 天） */
  averageOrderValue30d!: number;
  pendingPaymentCount!: number;
  /** 已付款待出貨（已付款＋處理中） */
  toShipCount!: number;
  newMembers30d!: number;
  totalMembers!: number;
}

export class SalesPointDto {
  /** YYYY-MM-DD（台灣時間） */
  date!: string;
  revenue!: number;
  orders!: number;
}

export class TopProductDto {
  productId!: string;
  name!: string;
  sku!: string;
  quantity!: number;
  revenue!: number;
}

export class LowStockProductDto {
  id!: string;
  name!: string;
  sku!: string;
  stock!: number;
}

export class UpcomingReleaseDto {
  id!: string;
  name!: string;
  @ApiProperty({ enum: SaleType, enumName: 'SaleType' })
  saleType!: SaleType;
  releaseAt!: Date;
  stock!: number;
}

export class DashboardDto {
  kpis!: DashboardKpisDto;
  /** 近 14 天每日營收 */
  salesTrend!: SalesPointDto[];
  /** 近 30 天熱銷商品 */
  topProducts!: TopProductDto[];
  lowStock!: LowStockProductDto[];
  upcomingReleases!: UpcomingReleaseDto[];
  recentOrders!: AdminOrderListItemDto[];
}
