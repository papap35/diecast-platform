import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { GarageCondition, MemberTier } from '../../../generated/prisma/enums.js';

export class GarageItemDto {
  id!: string;
  /** 本站商品（可連到商品頁）；手動登錄的其他來源車款為 null */
  productId!: string | null;
  productSlug!: string | null;
  /** 本站商品依語系顯示目前名稱，其餘為登錄時的名稱 */
  name!: string;
  brandName!: string | null;
  scale!: string | null;
  imageUrl!: string | null;
  @ApiProperty({ enum: GarageCondition, enumName: 'GarageCondition' })
  condition!: GarageCondition;
  quantity!: number;
  /** 購入價（只有本人看得到；公開車庫不會回傳） */
  pricePaid!: number | null;
  acquiredAt!: Date | null;
  note!: string | null;
  isFavorite!: boolean;
  /** ORDER：本站訂單完成後自動入庫；MANUAL：會員自行登錄 */
  @ApiProperty({ enum: ['ORDER', 'MANUAL'] })
  source!: 'ORDER' | 'MANUAL';
  createdAt!: Date;
}

export class CountByDto {
  label!: string;
  count!: number;
}

export class GarageStatsDto {
  /** 車款數（筆數） */
  models!: number;
  /** 總台數（含重複收藏） */
  cars!: number;
  /** 依品牌（台數多到少，前 8 名） */
  brands!: CountByDto[];
  /** 依比例 */
  scales!: CountByDto[];
}

export class GarageSettingsDto {
  public!: boolean;
  /** 公開車庫網址：/garage/{handle} */
  handle!: string | null;
}

export class GarageDto {
  items!: GarageItemDto[];
  stats!: GarageStatsDto;
  /** 購入總額（只有本人看得到） */
  totalPaid!: number;
  settings!: GarageSettingsDto;
}

export class PublicGarageDto {
  handle!: string;
  @ApiProperty({ enum: MemberTier, enumName: 'MemberTier' })
  tier!: MemberTier;
  /** 公開頁不含購入價與備註 */
  items!: GarageItemDto[];
  stats!: GarageStatsDto;
}

export class CreateGarageItemDto {
  /** 收藏本站商品；與 name 擇一 */
  @IsOptional()
  @IsUUID()
  productId?: string;

  /** 其他來源車款的名稱（未指定 productId 時必填） */
  @ValidateIf((o: CreateGarageItemDto) => !o.productId)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  brandName?: string;

  /** 比例，例如 1:64 */
  @IsOptional()
  @Matches(/^1:\d{1,3}$/, { message: '比例格式例如 1:64' })
  scale?: string;

  @ApiPropertyOptional({ enum: GarageCondition, enumName: 'GarageCondition' })
  @IsOptional()
  @IsIn(Object.values(GarageCondition))
  condition?: GarageCondition;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  quantity?: number;

  /** 購入價（新台幣） */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  pricePaid?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  acquiredAt?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;
}

export class UpdateGarageItemDto {
  @ApiPropertyOptional({ enum: GarageCondition, enumName: 'GarageCondition' })
  @IsOptional()
  @IsIn(Object.values(GarageCondition))
  condition?: GarageCondition;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  quantity?: number;

  /** 設為 null 清除 */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  pricePaid?: number | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  acquiredAt?: Date | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;
}

export class UpdateGarageSettingsDto {
  @IsBoolean()
  public!: boolean;

  /** 3–20 個小寫英數字或連字號，公開時必填 */
  @ValidateIf((o: UpdateGarageSettingsDto) => o.public || o.handle !== undefined)
  @Matches(/^[a-z0-9](?:[a-z0-9-]{1,18}[a-z0-9])$/, {
    message: '網址代稱為 3–20 個小寫英數字或連字號，不可以連字號開頭或結尾',
  })
  handle?: string;
}
