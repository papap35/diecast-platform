import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageMeta, PaginationQuery } from '../../../common/http/pagination.dto.js';
import { MemberStatus, MemberTier } from '../../../generated/prisma/enums.js';
import { AdminOrderListItemDto } from './admin-orders.dto.js';

export class AdminMemberQueryDto extends PaginationQuery {
  /** Email、姓名或電話 */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: MemberStatus, enumName: 'MemberStatus' })
  @IsOptional()
  @IsIn(Object.values(MemberStatus))
  status?: MemberStatus;

  @ApiPropertyOptional({ enum: MemberTier, enumName: 'MemberTier' })
  @IsOptional()
  @IsIn(Object.values(MemberTier))
  tier?: MemberTier;
}

export class AdminMemberListItemDto {
  id!: string;
  email!: string;
  name!: string;
  phone!: string | null;
  @ApiProperty({ enum: MemberStatus, enumName: 'MemberStatus' })
  status!: MemberStatus;
  @ApiProperty({ enum: MemberTier, enumName: 'MemberTier' })
  tier!: MemberTier;
  totalSpent!: number;
  orderCount!: number;
  lastLoginAt!: Date | null;
  createdAt!: Date;
}

export class AdminMemberListDto {
  data!: AdminMemberListItemDto[];
  meta!: PageMeta;
}

export class AdminMemberDto extends AdminMemberListItemDto {
  locale!: string;
  marketingOptIn!: boolean;
  recentOrders!: AdminOrderListItemDto[];
}

export class UpdateMemberStatusDto {
  /** 停權後會立即登出該會員所有裝置 */
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED'] })
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status!: 'ACTIVE' | 'SUSPENDED';
}
