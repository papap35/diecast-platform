import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/config.module.js';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { toPublicUrl } from '../../common/http/media.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { assertHasDefaultTranslation } from './admin-products.service.js';
import type {
  AdminBrandDto,
  AdminCategoryDto,
  CreateBrandDto,
  CreateCategoryDto,
  UpdateBrandDto,
  UpdateCategoryDto,
} from './dto/admin-catalog.dto.js';

/** 後台的品牌與分類管理 */
@Injectable()
export class AdminTaxonomyService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  // ── 品牌 ──

  async listBrands(): Promise<AdminBrandDto[]> {
    const brands = await this.prisma.brand.findMany({
      include: { translations: true, _count: { select: { products: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return brands.map((brand) => this.toBrandDto(brand));
  }

  async createBrand(dto: CreateBrandDto): Promise<AdminBrandDto> {
    const { translations, ...fields } = dto;
    const brand = await this.prisma.brand.create({
      data: { ...fields, translations: { create: translations ?? [] } },
      include: { translations: true, _count: { select: { products: true } } },
    });
    return this.toBrandDto(brand);
  }

  async updateBrand(id: string, dto: UpdateBrandDto): Promise<AdminBrandDto> {
    const { translations, ...fields } = dto;
    const brand = await this.prisma.$transaction(async (tx) => {
      if (translations) {
        await tx.brandTranslation.deleteMany({ where: { brandId: id } });
        await tx.brandTranslation.createMany({
          data: translations.map((t) => ({ ...t, brandId: id })),
        });
      }
      return tx.brand.update({
        where: { id },
        data: fields,
        include: { translations: true, _count: { select: { products: true } } },
      });
    });
    return this.toBrandDto(brand);
  }

  async deleteBrand(id: string): Promise<void> {
    const count = await this.prisma.product.count({ where: { brandId: id } });
    if (count > 0) {
      throw AppException.conflict(
        ErrorCode.CONFLICT,
        `此品牌仍有 ${count} 個商品，請先移轉或改為停用`,
      );
    }
    await this.prisma.brand.delete({ where: { id } });
  }

  // ── 分類 ──

  async listCategories(): Promise<AdminCategoryDto[]> {
    const categories = await this.prisma.category.findMany({
      include: { translations: true, _count: { select: { products: true } } },
      orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
    });
    return categories.map((category) => this.toCategoryDto(category));
  }

  async createCategory(dto: CreateCategoryDto): Promise<AdminCategoryDto> {
    assertHasDefaultTranslation(dto.translations);
    if (dto.parentId) await this.assertValidParent(dto.parentId);
    const { translations, ...fields } = dto;
    const category = await this.prisma.category.create({
      data: { ...fields, translations: { create: translations } },
      include: { translations: true, _count: { select: { products: true } } },
    });
    return this.toCategoryDto(category);
  }

  async updateCategory(id: string, dto: UpdateCategoryDto): Promise<AdminCategoryDto> {
    assertHasDefaultTranslation(dto.translations);
    if (dto.parentId) await this.assertValidParent(dto.parentId, id);
    const { translations, ...fields } = dto;
    const category = await this.prisma.$transaction(async (tx) => {
      if (translations) {
        await tx.categoryTranslation.deleteMany({ where: { categoryId: id } });
        await tx.categoryTranslation.createMany({
          data: translations.map((t) => ({ ...t, categoryId: id })),
        });
      }
      return tx.category.update({
        where: { id },
        data: fields,
        include: { translations: true, _count: { select: { products: true } } },
      });
    });
    return this.toCategoryDto(category);
  }

  async deleteCategory(id: string): Promise<void> {
    const [products, children] = await Promise.all([
      this.prisma.product.count({ where: { categoryId: id } }),
      this.prisma.category.count({ where: { parentId: id } }),
    ]);
    if (products > 0 || children > 0) {
      throw AppException.conflict(ErrorCode.CONFLICT, '分類底下仍有商品或子分類，無法刪除');
    }
    await this.prisma.category.delete({ where: { id } });
  }

  /** 分類只支援兩層：父分類本身不能再有父分類，也不能把自己設為父分類 */
  private async assertValidParent(parentId: string, selfId?: string): Promise<void> {
    if (parentId === selfId) {
      throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, '不能把分類設為自己的父分類');
    }
    const parent = await this.prisma.category.findUnique({ where: { id: parentId } });
    if (!parent) throw AppException.notFound(ErrorCode.NOT_FOUND, '找不到父分類');
    if (parent.parentId) {
      throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, '分類最多兩層');
    }
  }

  private toBrandDto(brand: {
    id: string;
    slug: string;
    name: string;
    country: string | null;
    logoUrl: string | null;
    sortOrder: number;
    isActive: boolean;
    translations: { locale: string; description: string }[];
    _count: { products: number };
  }): AdminBrandDto {
    return {
      id: brand.id,
      slug: brand.slug,
      name: brand.name,
      country: brand.country,
      logoUrl: brand.logoUrl ? toPublicUrl(brand.logoUrl, this.config.API_PUBLIC_URL) : null,
      sortOrder: brand.sortOrder,
      isActive: brand.isActive,
      translations: brand.translations.map(({ locale, description }) => ({ locale, description })),
      productCount: brand._count.products,
    };
  }

  private toCategoryDto(category: {
    id: string;
    slug: string;
    parentId: string | null;
    sortOrder: number;
    isActive: boolean;
    translations: { locale: string; name: string; description: string | null }[];
    _count: { products: number };
  }): AdminCategoryDto {
    return {
      id: category.id,
      slug: category.slug,
      parentId: category.parentId,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      translations: category.translations.map(({ locale, name, description }) => ({
        locale,
        name,
        description,
      })),
      productCount: category._count.products,
    };
  }
}
