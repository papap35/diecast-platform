import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PageMeta, PaginationQuery } from '../../../common/http/pagination.dto.js';
import { COUPON_CODE_PATTERN } from '../../../common/validation/patterns.js';
import { CouponType, MemberTier, ShippingMethod } from '../../../generated/prisma/enums.js';
import { QuoteItemDto } from '../../cart/dto/cart.dto.js';

const toUpper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

// ── 前台 ──

export class CouponPreviewRequestDto {
  @Transform(toUpper)
  @Matches(COUPON_CODE_PATTERN, { message: '優惠碼格式不正確' })
  code!: string;

  @ApiProperty({ enum: ShippingMethod, enumName: 'ShippingMethod' })
  @IsIn(Object.values(ShippingMethod))
  shippingMethod!: ShippingMethod;

  /** 立即購買的商品；省略則以購物車試算 */
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  items?: QuoteItemDto[];
}

export class CouponPreviewDto {
  code!: string;
  name!: string;
  @ApiProperty({ enum: CouponType, enumName: 'CouponType' })
  type!: CouponType;
  subtotal!: number;
  /** 優惠券折抵的商品金額 */
  discount!: number;
  /** 套用後的運費 */
  shippingFee!: number;
  /** 免運券省下的運費 */
  shippingDiscount!: number;
  total!: number;
}

// ── 後台 ──

export const COUPON_STATES = ['ACTIVE', 'SCHEDULED', 'EXPIRED', 'DISABLED', 'USED_UP'] as const;
export type CouponState = (typeof COUPON_STATES)[number];

export class CreateCouponDto {
  @Transform(toUpper)
  @Matches(COUPON_CODE_PATTERN, { message: '優惠碼需為 3～30 個英數、底線或連字號' })
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @ApiProperty({ enum: CouponType, enumName: 'CouponType' })
  @IsIn(Object.values(CouponType))
  type!: CouponType;

  /** FIXED：折抵金額；PERCENT：折扣百分比（1–90）；FREE_SHIPPING：填 0 */
  @IsInt()
  @Min(0)
  @Max(100_000)
  value!: number;

  /** 適用商品的小計門檻（不含運費） */
  @IsOptional()
  @IsInt()
  @Min(0)
  minSubtotal?: number;

  /** 百分比折扣的最高折抵金額 */
  @IsOptional()
  @IsInt()
  @Min(1)
  maxDiscount?: number | null;

  @ApiPropertyOptional({ enum: MemberTier, enumName: 'MemberTier', nullable: true })
  @IsOptional()
  @IsIn(Object.values(MemberTier))
  minTier?: MemberTier | null;

  /** 是否可用於限量商品 */
  @IsOptional()
  @IsBoolean()
  appliesToLimited?: boolean;

  /** 總使用次數上限；不填表示不限 */
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  perMemberLimit?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** 優惠碼與類型建立後不能修改 */
export class UpdateCouponDto extends PartialType(OmitType(CreateCouponDto, ['code', 'type'])) {}

export class AdminCouponQueryDto extends PaginationQuery {
  /** 搜尋優惠碼或名稱 */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;

  @ApiPropertyOptional({ enum: COUPON_STATES })
  @IsOptional()
  @IsIn(COUPON_STATES)
  state?: CouponState;
}

export class AdminCouponDto {
  id!: string;
  code!: string;
  name!: string;
  @ApiProperty({ enum: CouponType, enumName: 'CouponType' })
  type!: CouponType;
  value!: number;
  minSubtotal!: number;
  maxDiscount!: number | null;
  @ApiProperty({ enum: MemberTier, enumName: 'MemberTier', nullable: true })
  minTier!: MemberTier | null;
  appliesToLimited!: boolean;
  usageLimit!: number | null;
  perMemberLimit!: number;
  /** 已使用次數（不含已退回的） */
  usedCount!: number;
  startsAt!: Date | null;
  endsAt!: Date | null;
  isActive!: boolean;
  /** 目前狀態：可使用、尚未開始、已過期、已停用、已領完 */
  @ApiProperty({ enum: COUPON_STATES })
  state!: CouponState;
  /** 已折抵總金額（含免運券省下的運費，不含已退回的） */
  totalDiscount!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

export class AdminCouponListDto {
  data!: AdminCouponDto[];
  meta!: PageMeta;
}

export class CouponRedemptionDto {
  id!: string;
  orderId!: string;
  orderNo!: string;
  memberId!: string;
  memberEmail!: string;
  amount!: number;
  createdAt!: Date;
  /** 訂單未付款取消時退回 */
  releasedAt!: Date | null;
}

export class AdminCouponDetailDto extends AdminCouponDto {
  /** 最近 50 筆使用紀錄 */
  redemptions!: CouponRedemptionDto[];
}
