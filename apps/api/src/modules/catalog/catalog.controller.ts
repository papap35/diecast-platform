import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiLocaleQuery, ReqLocale } from '../../common/i18n/locale.decorator.js';
import type { Locale } from '../../common/i18n/locale.js';
import { CatalogService } from './catalog.service.js';
import {
  BrandDto,
  CategoryDto,
  ProductDetailDto,
  ProductListDto,
  ProductListQueryDto,
  ScaleOptionDto,
} from './dto/catalog.dto.js';

@ApiTags('Catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /** 品牌列表 */
  @Get('brands')
  @ApiLocaleQuery()
  listBrands(@ReqLocale() locale: Locale): Promise<BrandDto[]> {
    return this.catalog.listBrands(locale);
  }

  @Get('brands/:slug')
  @ApiLocaleQuery()
  getBrand(@Param('slug') slug: string, @ReqLocale() locale: Locale): Promise<BrandDto> {
    return this.catalog.getBrand(slug, locale);
  }

  /** 分類樹 */
  @Get('categories')
  @ApiLocaleQuery()
  listCategories(@ReqLocale() locale: Locale): Promise<CategoryDto[]> {
    return this.catalog.listCategories(locale);
  }

  /** 上架商品使用中的比例（篩選選項） */
  @Get('scales')
  listScales(): Promise<ScaleOptionDto[]> {
    return this.catalog.listScales();
  }

  /** 商品列表：關鍵字搜尋、品牌／分類／比例／販售方式／狀態／價格篩選、排序、分頁 */
  @Get('products')
  listProducts(
    @Query() query: ProductListQueryDto,
    @ReqLocale() locale: Locale,
  ): Promise<ProductListDto> {
    return this.catalog.listProducts(query, locale);
  }

  /** 商品詳情 */
  @Get('products/:slug')
  @ApiLocaleQuery()
  getProduct(@Param('slug') slug: string, @ReqLocale() locale: Locale): Promise<ProductDetailDto> {
    return this.catalog.getProduct(slug, locale);
  }
}
