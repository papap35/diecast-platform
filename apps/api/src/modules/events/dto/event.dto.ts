import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional } from 'class-validator';
import { PageMeta, PaginationQuery } from '../../../common/http/pagination.dto.js';
import { SUPPORTED_LOCALES, type Locale } from '../../../common/i18n/locale.js';
import { EventType } from '../../../generated/prisma/enums.js';
import { ProductSummaryDto } from '../../catalog/dto/catalog.dto.js';

export class EventSummaryDto {
  id!: string;
  slug!: string;
  @ApiProperty({ enum: EventType, enumName: 'EventType' })
  type!: EventType;
  title!: string;
  summary!: string;
  startsAt!: Date;
  endsAt!: Date | null;
  venue!: string | null;
  address!: string | null;
  /** 外部報名或活動頁 */
  url!: string | null;
  coverImageUrl!: string | null;
}

export class EventDetailDto extends EventSummaryDto {
  /** 活動說明（純文字，段落以空行分隔） */
  body!: string;
  /** 相關商品（例如發售活動的限量車款） */
  product!: ProductSummaryDto | null;
}

export class EventListDto {
  data!: EventSummaryDto[];
  meta!: PageMeta;
}

export class EventListQueryDto extends PaginationQuery {
  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: Locale;

  /** 結束時間在此之後（預設：現在，只列尚未結束的活動） */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  /** 開始時間在此之前 */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @ApiPropertyOptional({ enum: EventType, enumName: 'EventType' })
  @IsOptional()
  @IsIn(Object.values(EventType))
  type?: EventType;
}
