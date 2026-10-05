import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PageMeta, PaginationQuery } from '../../../common/http/pagination.dto.js';
import { SUPPORTED_LOCALES, type Locale } from '../../../common/i18n/locale.js';
import { SaleType } from '../../../generated/prisma/enums.js';
import { Availability } from '../availability.js';

export const PRODUCT_SORTS = ['newest', 'price_asc', 'price_desc', 'release', 'featured'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const AVAILABILITY_FILTERS = ['available', 'upcoming', 'preorder', 'sold_out'] as const;
export type AvailabilityFilter = (typeof AVAILABILITY_FILTERS)[number];

export class BrandSummaryDto {
  id!: string;
  slug!: string;
  name!: string;
}

export class BrandDto extends BrandSummaryDto {
  country!: string | null;
  logoUrl!: string | null;
  description!: string | null;
  /** 上架中的商品數 */
  productCount!: number;
}

export class CategorySummaryDto {
  id!: string;
  slug!: string;
  name!: string;
}

export class CategoryDto extends CategorySummaryDto {
  description!: string | null;
  parentId!: string | null;
  productCount!: number;
  @ApiProperty({ type: () => [CategoryDto] })
  children!: CategoryDto[];
}

export class ProductImageDto {
  url!: string;
  alt!: string | null;
}

export class ProductSummaryDto {
  id!: string;
  slug!: string;
  sku!: string;
  name!: string;
  subtitle!: string | null;
  brand!: BrandSummaryDto;
  category!: CategorySummaryDto;
  /** 比例，例如 1:64 */
  scale!: string;
  /** 售價（新台幣） */
  price!: number;
  compareAtPrice!: number | null;
  @ApiProperty({ enum: SaleType, enumName: 'SaleType' })
  saleType!: SaleType;
  /** 開賣（或預購開放）時間 */
  releaseAt!: Date | null;
  @ApiProperty({ enum: Availability, enumName: 'Availability' })
  availability!: Availability;
  /** 低庫存時顯示剩餘數量，其餘情況為 null（不公開實際庫存） */
  remaining!: number | null;
  imageUrl!: string | null;
  isFeatured!: boolean;
}

export class ProductDetailDto extends ProductSummaryDto {
  description!: string;
  /** 規格表，例如材質、輪胎、包裝 */
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  specs!: Record<string, string>;
  images!: ProductImageDto[];
  /** 每位會員限購數量；null 表示不限 */
  purchaseLimit!: number | null;
  preorderClosesAt!: Date | null;
  /** 預購商品預計出貨時間 */
  expectedShipAt!: Date | null;
}

export class ProductListDto {
  data!: ProductSummaryDto[];
  meta!: PageMeta;
}

export class LocaleQueryDto {
  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: Locale;
}

export class ProductListQueryDto extends PaginationQuery {
  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: Locale;

  /** 關鍵字（商品名稱、品牌、SKU） */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  /** 品牌 slug */
  @IsOptional()
  @IsString()
  brand?: string;

  /** 分類 slug（含子分類） */
  @IsOptional()
  @IsString()
  category?: string;

  /** 比例，例如 1:64 */
  @IsOptional()
  @IsString()
  scale?: string;

  @ApiPropertyOptional({ enum: SaleType, enumName: 'SaleType' })
  @IsOptional()
  @IsIn(Object.values(SaleType))
  saleType?: SaleType;

  @ApiPropertyOptional({ enum: AVAILABILITY_FILTERS })
  @IsOptional()
  @IsIn(AVAILABILITY_FILTERS)
  availability?: AvailabilityFilter;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ enum: PRODUCT_SORTS, default: 'newest' })
  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  sort?: ProductSort;
}

export class ScaleOptionDto {
  scale!: string;
  productCount!: number;
}
