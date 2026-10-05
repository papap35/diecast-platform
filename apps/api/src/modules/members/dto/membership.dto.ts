import { ApiProperty } from '@nestjs/swagger';
import { MemberTier } from '../../../generated/prisma/enums.js';

export class TierInfoDto {
  @ApiProperty({ enum: MemberTier, enumName: 'MemberTier' })
  tier!: MemberTier;
  /** 累計消費門檻（新台幣） */
  threshold!: number;
  /** 宅配免運門檻（0 表示一律免運） */
  homeFreeShipping!: number;
  /** 超商取貨免運門檻（0 表示一律免運） */
  cvsFreeShipping!: number;
  /** 可參加限量車款優先購（各商品另行設定開放的等級） */
  earlyAccess!: boolean;
}

export class NextTierDto {
  @ApiProperty({ enum: MemberTier, enumName: 'MemberTier' })
  tier!: MemberTier;
  threshold!: number;
  /** 距離升級還差的消費金額 */
  remaining!: number;
}

export class MembershipDto {
  @ApiProperty({ enum: MemberTier, enumName: 'MemberTier' })
  tier!: MemberTier;
  /** 累計有效消費（已付款且未退款的訂單） */
  totalSpent!: number;
  tierUpdatedAt!: Date | null;
  next!: NextTierDto | null;
  tiers!: TierInfoDto[];
}
