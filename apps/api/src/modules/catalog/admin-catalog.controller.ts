import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminPrincipal } from '../auth/auth.types.js';
import { AdminAuth, CurrentAdmin, RequirePermissions } from '../auth/decorators.js';
import { Permission } from '../auth/permissions.js';
import { AdminProductsService } from './admin-products.service.js';
import { AdminTaxonomyService } from './admin-taxonomy.service.js';
import {
  AdjustStockDto,
  AdminBrandDto,
  AdminCategoryDto,
  AdminProductDto,
  AdminProductListDto,
  AdminProductQueryDto,
  CreateBrandDto,
  CreateCategoryDto,
  CreateProductDto,
  StockLevelDto,
  StockMovementDto,
  UpdateBrandDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from './dto/admin-catalog.dto.js';

@ApiTags('Admin / Products')
@AdminAuth(Permission.ProductRead)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly products: AdminProductsService) {}

  @Get()
  list(@Query() query: AdminProductQueryDto): Promise<AdminProductListDto> {
    return this.products.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminProductDto> {
    return this.products.get(id);
  }

  @Post()
  @RequirePermissions(Permission.ProductWrite)
  create(
    @Body() dto: CreateProductDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<AdminProductDto> {
    return this.products.create(dto, admin.id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.ProductWrite)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<AdminProductDto> {
    return this.products.update(id, dto);
  }

  /** 下架封存 */
  @Delete(':id')
  @RequirePermissions(Permission.ProductWrite)
  archive(@Param('id', ParseUUIDPipe) id: string): Promise<AdminProductDto> {
    return this.products.archive(id);
  }

  /** 調整庫存（增減量），會留下異動紀錄 */
  @Post(':id/stock')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ProductWrite)
  async adjustStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustStockDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<StockLevelDto> {
    return { stock: await this.products.adjustStock(id, dto.delta, admin.id, dto.note) };
  }

  /** 庫存異動紀錄（最新 100 筆） */
  @Get(':id/stock-movements')
  stockMovements(@Param('id', ParseUUIDPipe) id: string): Promise<StockMovementDto[]> {
    return this.products.stockMovements(id);
  }
}

@ApiTags('Admin / Brands & Categories')
@AdminAuth(Permission.ProductRead)
@Controller('admin')
export class AdminTaxonomyController {
  constructor(private readonly taxonomy: AdminTaxonomyService) {}

  @Get('brands')
  listBrands(): Promise<AdminBrandDto[]> {
    return this.taxonomy.listBrands();
  }

  @Post('brands')
  @RequirePermissions(Permission.CatalogWrite)
  createBrand(@Body() dto: CreateBrandDto): Promise<AdminBrandDto> {
    return this.taxonomy.createBrand(dto);
  }

  @Patch('brands/:id')
  @RequirePermissions(Permission.CatalogWrite)
  updateBrand(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBrandDto,
  ): Promise<AdminBrandDto> {
    return this.taxonomy.updateBrand(id, dto);
  }

  @Delete('brands/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.CatalogWrite)
  deleteBrand(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.taxonomy.deleteBrand(id);
  }

  @Get('categories')
  listCategories(): Promise<AdminCategoryDto[]> {
    return this.taxonomy.listCategories();
  }

  @Post('categories')
  @RequirePermissions(Permission.CatalogWrite)
  createCategory(@Body() dto: CreateCategoryDto): Promise<AdminCategoryDto> {
    return this.taxonomy.createCategory(dto);
  }

  @Patch('categories/:id')
  @RequirePermissions(Permission.CatalogWrite)
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<AdminCategoryDto> {
    return this.taxonomy.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.CatalogWrite)
  deleteCategory(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.taxonomy.deleteCategory(id);
  }
}
