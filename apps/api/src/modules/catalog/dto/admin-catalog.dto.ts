import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  NotEquals,
  ValidateNested,
} from 'class-validator';
import { PageMeta, PaginationQuery } from '../../../common/http/pagination.dto.js';
import { SUPPORTED_LOCALES } from '../../../common/i18n/locale.js';
import { ProductStatus, SaleType, StockMovementReason } from '../../../generated/prisma/enums.js';
import { Availability } from '../availability.js';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MESSAGE = 'slug 只能使用小寫英數字與連字號';

// ── 共用 ──

export class TranslationLocaleInput {
  @ApiProperty({ enum: SUPPORTED_LOCALES })
  @IsIn(SUPPORTED_LOCALES)
  locale!: string;
}

// ── 商品 ──

export class ProductTranslationInput extends TranslationLocaleInput {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  subtitle?: string | null;

  @IsString()
  @MaxLength(5000)
  description!: string;
}

export class ProductImageInput {
  /** 圖片網址（完整網址，或內建示範圖片的 /static/... 路徑） */
  @IsString()
  @MaxLength(2048)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  alt?: string | null;
}

export class CreateProductDto {
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  @MaxLength(120)
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  sku!: string;

  @IsUUID()
  brandId!: string;

  @IsUUID()
  categoryId!: string;

  /** 例如 1:64、1:43、1:18 */
  @Matches(/^1:\d{1,3}$/, { message: '比例格式應為 1:64 這種形式' })
  scale!: string;

  @IsInt()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  compareAtPrice?: number | null;

  /** 初始庫存（之後請用庫存調整 API，系統會留下異動紀錄） */
  @IsInt()
  @Min(0)
  stock!: number;

  @ApiProperty({ enum: ProductStatus, enumName: 'ProductStatus' })
  @IsIn(Object.values(ProductStatus))
  status!: ProductStatus;

  @ApiProperty({ enum: SaleType, enumName: 'SaleType' })
  @IsIn(Object.values(SaleType))
  saleType!: SaleType;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  releaseAt?: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  preorderClosesAt?: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expectedShipAt?: Date | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  purchaseLimit?: number | null;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'string' } })
  @IsOptional()
  @IsObject()
  specs?: Record<string, string>;

  /** 至少需要繁體中文（zh-TW） */
  @ValidateNested({ each: true })
  @Type(() => ProductTranslationInput)
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  translations!: ProductTranslationInput[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ProductImageInput)
  @ArrayMaxSize(12)
  images?: ProductImageInput[];
}

export class UpdateProductDto extends PartialType(OmitType(CreateProductDto, ['stock'] as const)) {}

export class AdjustStockDto {
  /** 增減量，正數為入庫、負數為扣除 */
  @IsInt()
  @NotEquals(0)
  delta!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class StockLevelDto {
  stock!: number;
}

export class StockMovementDto {
  id!: string;
  delta!: number;
  balance!: number;
  @ApiProperty({ enum: StockMovementReason, enumName: 'StockMovementReason' })
  reason!: StockMovementReason;
  orderId!: string | null;
  actorId!: string | null;
  note!: string | null;
  createdAt!: Date;
}

export class AdminProductQueryDto extends PaginationQuery {
  /** 名稱或 SKU */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: ProductStatus, enumName: 'ProductStatus' })
  @IsOptional()
  @IsIn(Object.values(ProductStatus))
  status?: ProductStatus;

  @ApiPropertyOptional({ enum: SaleType, enumName: 'SaleType' })
  @IsOptional()
  @IsIn(Object.values(SaleType))
  saleType?: SaleType;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /** 只顯示低庫存（≤5） */
  @IsOptional()
  @IsIn(['true', 'false'])
  lowStock?: 'true' | 'false';
}

export class ProductTranslationDto {
  locale!: string;
  name!: string;
  subtitle!: string | null;
  description!: string;
}

export class AdminProductImageDto {
  id!: string;
  /** 可直接顯示的完整網址 */
  url!: string;
  /** 資料庫儲存的原始值（編輯時回傳這個） */
  path!: string;
  alt!: string | null;
  sortOrder!: number;
}

export class AdminProductListItemDto {
  id!: string;
  slug!: string;
  sku!: string;
  /** 繁中名稱 */
  name!: string;
  brandName!: string;
  categoryName!: string;
  scale!: string;
  price!: number;
  stock!: number;
  @ApiProperty({ enum: ProductStatus, enumName: 'ProductStatus' })
  status!: ProductStatus;
  @ApiProperty({ enum: SaleType, enumName: 'SaleType' })
  saleType!: SaleType;
  releaseAt!: Date | null;
  @ApiProperty({ enum: Availability, enumName: 'Availability' })
  availability!: Availability;
  imageUrl!: string | null;
  updatedAt!: Date;
}

export class AdminProductListDto {
  data!: AdminProductListItemDto[];
  meta!: PageMeta;
}

export class AdminProductDto {
  id!: string;
  slug!: string;
  sku!: string;
  brandId!: string;
  categoryId!: string;
  scale!: string;
  price!: number;
  compareAtPrice!: number | null;
  stock!: number;
  @ApiProperty({ enum: ProductStatus, enumName: 'ProductStatus' })
  status!: ProductStatus;
  @ApiProperty({ enum: SaleType, enumName: 'SaleType' })
  saleType!: SaleType;
  releaseAt!: Date | null;
  preorderClosesAt!: Date | null;
  expectedShipAt!: Date | null;
  purchaseLimit!: number | null;
  isFeatured!: boolean;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  specs!: Record<string, string>;
  translations!: ProductTranslationDto[];
  images!: AdminProductImageDto[];
  @ApiProperty({ enum: Availability, enumName: 'Availability' })
  availability!: Availability;
  /** 已成立（非取消）訂單的累計售出數量 */
  soldCount!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

// ── 品牌 ──

export class BrandTranslationInput extends TranslationLocaleInput {
  @IsString()
  @MaxLength(2000)
  description!: string;
}

export class CreateBrandDto {
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  @MaxLength(60)
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  country?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  logoUrl?: string | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => BrandTranslationInput)
  @ArrayMaxSize(3)
  translations?: BrandTranslationInput[];
}

export class UpdateBrandDto extends PartialType(CreateBrandDto) {}

export class BrandTranslationDto {
  locale!: string;
  description!: string;
}

export class AdminBrandDto {
  id!: string;
  slug!: string;
  name!: string;
  country!: string | null;
  logoUrl!: string | null;
  sortOrder!: number;
  isActive!: boolean;
  translations!: BrandTranslationDto[];
  productCount!: number;
}

// ── 分類 ──

export class CategoryTranslationInput extends TranslationLocaleInput {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;
}

export class CreateCategoryDto {
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  @MaxLength(60)
  slug!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** 至少需要繁體中文（zh-TW） */
  @ValidateNested({ each: true })
  @Type(() => CategoryTranslationInput)
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  translations!: CategoryTranslationInput[];
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export class CategoryTranslationDto {
  locale!: string;
  name!: string;
  description!: string | null;
}

export class AdminCategoryDto {
  id!: string;
  slug!: string;
  parentId!: string | null;
  sortOrder!: number;
  isActive!: boolean;
  translations!: CategoryTranslationDto[];
  productCount!: number;
}
