import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
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
  ValidateNested,
} from 'class-validator';
import { PageMeta, PaginationQuery } from '../../../common/http/pagination.dto.js';
import { SUPPORTED_LOCALES, type Locale } from '../../../common/i18n/locale.js';
import {
  LINK_MESSAGE,
  LINK_PATTERN,
  SLUG_MESSAGE,
  SLUG_PATTERN,
} from '../../../common/validation/patterns.js';
import {
  BannerPlacement,
  BannerTheme,
  ContentStatus,
  EventType,
} from '../../../generated/prisma/enums.js';
import { TranslationLocaleInput } from '../../catalog/dto/admin-catalog.dto.js';

// ── 活動 ──

export class EventTranslationInput extends TranslationLocaleInput {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  /** 列表與分享用的一句話介紹 */
  @IsString()
  @MaxLength(300)
  summary!: string;

  /** 活動說明（純文字，段落以空行分隔） */
  @IsString()
  @MaxLength(10000)
  body!: string;
}

export class CreateEventDto {
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  @MaxLength(120)
  slug!: string;

  @ApiProperty({ enum: EventType, enumName: 'EventType' })
  @IsIn(Object.values(EventType))
  type!: EventType;

  @ApiProperty({ enum: ContentStatus, enumName: 'ContentStatus' })
  @IsIn(Object.values(ContentStatus))
  status!: ContentStatus;

  @Type(() => Date)
  @IsDate()
  startsAt!: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  venue?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string | null;

  /** 外部報名或活動頁 */
  @IsOptional()
  @Matches(LINK_PATTERN, { message: LINK_MESSAGE })
  @MaxLength(2048)
  url?: string | null;

  @IsOptional()
  @Matches(LINK_PATTERN, { message: LINK_MESSAGE })
  @MaxLength(2048)
  coverImageUrl?: string | null;

  /** 相關商品（例如發售活動的限量車款） */
  @IsOptional()
  @IsUUID()
  productId?: string | null;

  @ValidateNested({ each: true })
  @Type(() => EventTranslationInput)
  @ArrayMinSize(1)
  @ArrayMaxSize(SUPPORTED_LOCALES.length)
  translations!: EventTranslationInput[];
}

export class UpdateEventDto extends PartialType(CreateEventDto) {}

export class AdminEventQueryDto extends PaginationQuery {
  @ApiPropertyOptional({ enum: ContentStatus, enumName: 'ContentStatus' })
  @IsOptional()
  @IsIn(Object.values(ContentStatus))
  status?: ContentStatus;

  @ApiPropertyOptional({ enum: EventType, enumName: 'EventType' })
  @IsOptional()
  @IsIn(Object.values(EventType))
  type?: EventType;

  /** 搜尋標題或 slug */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class EventTranslationDto {
  locale!: string;
  title!: string;
  summary!: string;
  body!: string;
}

export class EventProductRefDto {
  id!: string;
  sku!: string;
  name!: string;
}

export class AdminEventListItemDto {
  id!: string;
  slug!: string;
  @ApiProperty({ enum: EventType, enumName: 'EventType' })
  type!: EventType;
  @ApiProperty({ enum: ContentStatus, enumName: 'ContentStatus' })
  status!: ContentStatus;
  /** 繁中標題 */
  title!: string;
  startsAt!: Date;
  endsAt!: Date | null;
  venue!: string | null;
  product!: EventProductRefDto | null;
  updatedAt!: Date;
}

export class AdminEventListDto {
  data!: AdminEventListItemDto[];
  meta!: PageMeta;
}

export class AdminEventDto extends AdminEventListItemDto {
  address!: string | null;
  url!: string | null;
  coverImageUrl!: string | null;
  productId!: string | null;
  translations!: EventTranslationDto[];
  createdAt!: Date;
}

// ── 公告與首頁橫幅 ──

export class BannerTranslationInput extends TranslationLocaleInput {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subtitle?: string | null;

  /** 按鈕文字（首頁橫幅） */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  ctaLabel?: string | null;
}

export class CreateBannerDto {
  @ApiProperty({ enum: BannerPlacement, enumName: 'BannerPlacement' })
  @IsIn(Object.values(BannerPlacement))
  placement!: BannerPlacement;

  @ApiProperty({ enum: ContentStatus, enumName: 'ContentStatus' })
  @IsIn(Object.values(ContentStatus))
  status!: ContentStatus;

  @ApiProperty({ enum: BannerTheme, enumName: 'BannerTheme' })
  @IsIn(Object.values(BannerTheme))
  theme!: BannerTheme;

  /** 站內路徑（例如 /events/taipei-show）或 https 網址 */
  @IsOptional()
  @Matches(LINK_PATTERN, { message: LINK_MESSAGE })
  @MaxLength(2048)
  linkUrl?: string | null;

  @IsOptional()
  @Matches(LINK_PATTERN, { message: LINK_MESSAGE })
  @MaxLength(2048)
  imageUrl?: string | null;

  /** 未設定表示發布後立即上架 */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date | null;

  /** 未設定表示不自動下架 */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date | null;

  /** 數字小的排前面 */
  @IsOptional()
  @IsInt()
  @Min(-999)
  @Max(999)
  sortOrder?: number;

  @ValidateNested({ each: true })
  @Type(() => BannerTranslationInput)
  @ArrayMinSize(1)
  @ArrayMaxSize(SUPPORTED_LOCALES.length)
  translations!: BannerTranslationInput[];
}

export class UpdateBannerDto extends PartialType(OmitType(CreateBannerDto, ['placement'])) {}

export class BannerQueryDto {
  @ApiProperty({ enum: BannerPlacement, enumName: 'BannerPlacement' })
  @IsIn(Object.values(BannerPlacement))
  placement!: BannerPlacement;

  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: Locale;
}

export class AdminBannerQueryDto {
  @ApiPropertyOptional({ enum: BannerPlacement, enumName: 'BannerPlacement' })
  @IsOptional()
  @IsIn(Object.values(BannerPlacement))
  placement?: BannerPlacement;
}

/** 前台顯示用（已依語系挑好文字） */
export class BannerDto {
  id!: string;
  @ApiProperty({ enum: BannerPlacement, enumName: 'BannerPlacement' })
  placement!: BannerPlacement;
  @ApiProperty({ enum: BannerTheme, enumName: 'BannerTheme' })
  theme!: BannerTheme;
  title!: string;
  subtitle!: string | null;
  ctaLabel!: string | null;
  linkUrl!: string | null;
  imageUrl!: string | null;
}

export class BannerTranslationDto {
  locale!: string;
  title!: string;
  subtitle!: string | null;
  ctaLabel!: string | null;
}

export const BANNER_STATES = ['DRAFT', 'SCHEDULED', 'LIVE', 'ENDED'] as const;
export type BannerState = (typeof BANNER_STATES)[number];

export class AdminBannerDto {
  id!: string;
  @ApiProperty({ enum: BannerPlacement, enumName: 'BannerPlacement' })
  placement!: BannerPlacement;
  @ApiProperty({ enum: ContentStatus, enumName: 'ContentStatus' })
  status!: ContentStatus;
  /** 目前實際狀態：草稿、排程中、上架中、已下架 */
  @ApiProperty({ enum: BANNER_STATES })
  state!: BannerState;
  @ApiProperty({ enum: BannerTheme, enumName: 'BannerTheme' })
  theme!: BannerTheme;
  /** 繁中標題 */
  title!: string;
  linkUrl!: string | null;
  imageUrl!: string | null;
  startsAt!: Date | null;
  endsAt!: Date | null;
  sortOrder!: number;
  translations!: BannerTranslationDto[];
  updatedAt!: Date;
}

export class AdminBannerListDto {
  data!: AdminBannerDto[];
}
