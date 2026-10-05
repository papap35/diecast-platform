import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/config.module.js';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { toPublicUrl } from '../../common/http/media.js';
import { pageMeta, skipTake } from '../../common/http/pagination.dto.js';
import { pickTranslation } from '../../common/i18n/locale.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { computeAvailability, LOW_STOCK_THRESHOLD } from './availability.js';
import type {
  AdminProductDto,
  AdminProductListDto,
  AdminProductQueryDto,
  CreateProductDto,
  ProductImageInput,
  ProductTranslationInput,
  StockMovementDto,
  UpdateProductDto,
} from './dto/admin-catalog.dto.js';

const adminProductInclude = {
  translations: true,
  images: { orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.ProductInclude;

type AdminProductRecord = Prisma.ProductGetPayload<{ include: typeof adminProductInclude }>;

export function assertHasDefaultTranslation(translations: { locale: string }[] | undefined): void {
  if (!translations) return;
  const locales = translations.map((t) => t.locale);
  if (!locales.includes('zh-TW')) {
    throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, '至少需要繁體中文（zh-TW）內容', [
      { field: 'translations', messages: ['缺少 zh-TW'] },
    ]);
  }
  if (new Set(locales).size !== locales.length) {
    throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, '同一語系不可重複', [
      { field: 'translations', messages: ['語系重複'] },
    ]);
  }
}

@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async list(query: AdminProductQueryDto): Promise<AdminProductListDto> {
    const and: Prisma.ProductWhereInput[] = [];
    if (query.q?.trim()) {
      const q = query.q.trim();
      and.push({
        OR: [
          { translations: { some: { name: { contains: q, mode: 'insensitive' } } } },
          { sku: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    if (query.status) and.push({ status: query.status });
    if (query.saleType) and.push({ saleType: query.saleType });
    if (query.brandId) and.push({ brandId: query.brandId });
    if (query.categoryId) and.push({ categoryId: query.categoryId });
    if (query.lowStock === 'true') and.push({ stock: { lte: LOW_STOCK_THRESHOLD } });
    const where: Prisma.ProductWhereInput = { AND: and };

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: {
          translations: true,
          brand: true,
          category: { include: { translations: true } },
          images: { orderBy: { sortOrder: 'asc' }, take: 1 },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        ...skipTake(query),
      }),
    ]);

    return {
      data: products.map((p) => ({
        id: p.id,
        slug: p.slug,
        sku: p.sku,
        name: pickTranslation(p.translations, 'zh-TW')?.name ?? p.sku,
        brandName: p.brand.name,
        categoryName: pickTranslation(p.category.translations, 'zh-TW')?.name ?? p.category.slug,
        scale: p.scale,
        price: p.price,
        stock: p.stock,
        status: p.status,
        saleType: p.saleType,
        releaseAt: p.releaseAt,
        availability: computeAvailability(p),
        imageUrl: p.images[0] ? this.mediaUrl(p.images[0].url) : null,
        updatedAt: p.updatedAt,
      })),
      meta: pageMeta(query.page, query.pageSize, total),
    };
  }

  async get(id: string): Promise<AdminProductDto> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: adminProductInclude,
    });
    if (!product) throw AppException.notFound(ErrorCode.PRODUCT_NOT_FOUND, '找不到這個商品');
    return this.toDto(product);
  }

  async create(dto: CreateProductDto, actorId: string): Promise<AdminProductDto> {
    assertHasDefaultTranslation(dto.translations);
    this.assertSaleWindow(dto);
    const { translations, images, stock, specs, ...fields } = dto;

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          ...fields,
          stock: 0,
          specs: specs ?? {},
          translations: { create: translations.map(toTranslationData) },
          images: { create: (images ?? []).map(toImageData) },
        },
      });
      if (stock > 0) {
        await this.inventory.increment(tx, created.id, stock, {
          reason: 'ADMIN_ADJUSTMENT',
          actorId,
          note: '建立商品時的初始庫存',
        });
      }
      return tx.product.findUniqueOrThrow({
        where: { id: created.id },
        include: adminProductInclude,
      });
    });
    return this.toDto(product);
  }

  async update(id: string, dto: UpdateProductDto): Promise<AdminProductDto> {
    const current = await this.prisma.product.findUnique({ where: { id } });
    if (!current) throw AppException.notFound(ErrorCode.PRODUCT_NOT_FOUND, '找不到這個商品');
    assertHasDefaultTranslation(dto.translations);
    this.assertSaleWindow({ ...current, ...dto });

    const { translations, images, specs, ...fields } = dto;
    const product = await this.prisma.$transaction(async (tx) => {
      if (translations) {
        await tx.productTranslation.deleteMany({ where: { productId: id } });
        await tx.productTranslation.createMany({
          data: translations.map((t) => ({ ...toTranslationData(t), productId: id })),
        });
      }
      if (images) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        await tx.productImage.createMany({
          data: images.map((image, index) => ({ ...toImageData(image, index), productId: id })),
        });
      }
      return tx.product.update({
        where: { id },
        data: { ...fields, ...(specs ? { specs } : {}) },
        include: adminProductInclude,
      });
    });
    return this.toDto(product);
  }

  /** 下架（封存）。有訂單紀錄的商品不做實體刪除 */
  async archive(id: string): Promise<AdminProductDto> {
    const product = await this.prisma.product.update({
      where: { id },
      data: { status: 'ARCHIVED' },
      include: adminProductInclude,
    });
    return this.toDto(product);
  }

  adjustStock(id: string, delta: number, actorId: string, note?: string): Promise<number> {
    return this.inventory.adjust(id, delta, actorId, note);
  }

  async stockMovements(id: string): Promise<StockMovementDto[]> {
    return this.prisma.stockMovement.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private async toDto(product: AdminProductRecord): Promise<AdminProductDto> {
    const sold = await this.prisma.orderItem.aggregate({
      where: { productId: product.id, order: { status: { notIn: ['CANCELLED', 'REFUNDED'] } } },
      _sum: { quantity: true },
    });
    return {
      id: product.id,
      slug: product.slug,
      sku: product.sku,
      brandId: product.brandId,
      categoryId: product.categoryId,
      scale: product.scale,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      stock: product.stock,
      status: product.status,
      saleType: product.saleType,
      releaseAt: product.releaseAt,
      preorderClosesAt: product.preorderClosesAt,
      expectedShipAt: product.expectedShipAt,
      purchaseLimit: product.purchaseLimit,
      isFeatured: product.isFeatured,
      specs: (product.specs as Record<string, string> | null) ?? {},
      translations: product.translations.map((t) => ({
        locale: t.locale,
        name: t.name,
        subtitle: t.subtitle,
        description: t.description,
      })),
      images: product.images.map((image) => ({
        id: image.id,
        url: this.mediaUrl(image.url),
        path: image.url,
        alt: image.alt,
        sortOrder: image.sortOrder,
      })),
      availability: computeAvailability(product),
      soldCount: sold._sum.quantity ?? 0,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private assertSaleWindow(product: {
    saleType?: string;
    releaseAt?: Date | null;
    preorderClosesAt?: Date | null;
  }): void {
    if (product.saleType === 'LIMITED' && !product.releaseAt) {
      throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, '限量發售商品必須設定開賣時間', [
        { field: 'releaseAt', messages: ['限量發售需要開賣時間'] },
      ]);
    }
    if (
      product.releaseAt &&
      product.preorderClosesAt &&
      product.preorderClosesAt <= product.releaseAt
    ) {
      throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, '預購截止時間需晚於開放時間', [
        { field: 'preorderClosesAt', messages: ['需晚於 releaseAt'] },
      ]);
    }
  }

  private mediaUrl(url: string): string {
    return toPublicUrl(url, this.config.API_PUBLIC_URL);
  }
}

function toTranslationData(t: ProductTranslationInput) {
  return {
    locale: t.locale,
    name: t.name.trim(),
    subtitle: t.subtitle ?? null,
    description: t.description,
  };
}

function toImageData(image: ProductImageInput, index: number) {
  return { url: image.url, alt: image.alt ?? null, sortOrder: index };
}
