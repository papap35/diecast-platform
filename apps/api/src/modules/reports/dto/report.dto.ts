import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { IsCalendarDay } from '../../../common/validation/calendar-day.js';
import {
  MemberTier,
  OrderStatus,
  SaleType,
  ShippingMethod,
} from '../../../generated/prisma/enums.js';

export const GRANULARITIES = ['day', 'week', 'month'] as const;
export type Granularity = (typeof GRANULARITIES)[number];

export class ReportRangeQueryDto {
  /** 起日（含，台北時間 YYYY-MM-DD）；預設迄日往前 29 天 */
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsCalendarDay()
  from?: string;

  /** 迄日（含，台北時間 YYYY-MM-DD）；預設今天 */
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsCalendarDay()
  to?: string;
}

export class SalesReportQueryDto extends ReportRangeQueryDto {
  /** 趨勢圖的時間單位；依日最長 366 天、依週 3 年、依月 5 年 */
  @ApiPropertyOptional({ enum: GRANULARITIES, default: 'day' })
  @IsOptional()
  @IsIn(GRANULARITIES)
  granularity?: Granularity;
}

export class OrdersExportQueryDto extends ReportRangeQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus, enumName: 'OrderStatus' })
  @IsOptional()
  @IsIn(Object.values(OrderStatus))
  status?: OrderStatus;
}

export class ReportTotalsDto {
  /** 營收：期間內付款、目前仍有效（未退款）訂單的實付金額（含運費、已扣優惠） */
  revenue!: number;
  orders!: number;
  /** 售出件數 */
  units!: number;
  averageOrderValue!: number;
  /** 下單的不重複會員數 */
  customers!: number;
  /** 優惠券折抵總額（商品折扣＋免運券省下的運費） */
  discount!: number;
  /** 實收運費 */
  shippingFee!: number;
  /** 期間內退款的訂單（依退款日計算） */
  refundOrders!: number;
  refundAmount!: number;
  /** 期間內註冊的會員 */
  newMembers!: number;
}

export class ReportPointDto {
  /** 期間起始日（台北時間 YYYY-MM-DD；週為週一、月為 1 日） */
  date!: string;
  revenue!: number;
  orders!: number;
}

export class ReportBreakdownDto {
  /** 品牌或分類 id */
  key!: string;
  /** 顯示名稱 */
  label!: string;
  /** 商品實收（扣除優惠券分攤，不含運費） */
  revenue!: number;
  units!: number;
}

export class ReportSaleTypeDto {
  @ApiProperty({ enum: SaleType, enumName: 'SaleType' })
  saleType!: SaleType;
  revenue!: number;
  units!: number;
}

export class ReportShippingDto {
  @ApiProperty({ enum: ShippingMethod, enumName: 'ShippingMethod' })
  method!: ShippingMethod;
  orders!: number;
  /** 訂單實付金額（含運費） */
  revenue!: number;
}

export class ReportTierDto {
  @ApiProperty({ enum: MemberTier, enumName: 'MemberTier' })
  tier!: MemberTier;
  /** 目前在這個等級的會員數 */
  members!: number;
  /** 期間內有下單的會員數（依目前等級歸類） */
  customers!: number;
  /** 這些會員在期間內的訂單實付金額 */
  revenue!: number;
}

export class ReportProductDto {
  productId!: string;
  sku!: string;
  name!: string;
  /** 商品實收（扣除優惠券分攤，不含運費） */
  revenue!: number;
  units!: number;
}

export class ReportCouponDto {
  couponId!: string;
  code!: string;
  name!: string;
  orders!: number;
  /** 折抵總額（含免運券省下的運費） */
  discount!: number;
  /** 使用這張優惠券的訂單實付金額 */
  revenue!: number;
}

export class SalesReportDto {
  from!: string;
  to!: string;
  @ApiProperty({ enum: GRANULARITIES })
  granularity!: Granularity;
  totals!: ReportTotalsDto;
  /** 前一段同樣長度的期間，用來計算成長率 */
  previous!: ReportTotalsDto;
  previousFrom!: string;
  previousTo!: string;
  trend!: ReportPointDto[];
  byBrand!: ReportBreakdownDto[];
  /** 依第一層分類加總 */
  byCategory!: ReportBreakdownDto[];
  bySaleType!: ReportSaleTypeDto[];
  byShipping!: ReportShippingDto[];
  byTier!: ReportTierDto[];
  /** 商品實收前 10 名 */
  topProducts!: ReportProductDto[];
  /** 使用次數前 20 名 */
  coupons!: ReportCouponDto[];
}
