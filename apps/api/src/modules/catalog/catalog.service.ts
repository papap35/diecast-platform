import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/config.module.js';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { toPublicUrl } from '../../common/http/media.js';
import { pageMeta, skipTake } from '../../common/http/pagination.dto.js';
import { type Locale, pickTranslation } from '../../common/i18n/locale.js';
import type { MemberTier, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { Availability, computeAvailability, LOW_STOCK_THRESHOLD } from './availability.js';
import type {
  AvailabilityFilter,
  BrandDto,
  CategoryDto,
  ProductDetailDto,
  ProductListDto,
  ProductListQueryDto,
  ProductSort,
  ProductSummaryDto,
  ScaleOptionDto,
} from './dto/catalog.dto.js';

export const productSummaryInclude = {
  translations: true,
  brand: true,
  category: { include: { translations: true } },
  images: { orderBy: { sortOrder: 'asc' }, take: 1 },
} satisfies Prisma.ProductInclude;

export type ProductWithSummary = Prisma.ProductGetPayload<{
  include: typeof productSummaryInclude;
}>;

const productDetailInclude = {
  ...productSummaryInclude,
  images: { orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.ProductInclude;

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async listBrands(locale: Locale): Promise<BrandDto[]> {
    const brands = await this.prisma.brand.findMany({
      where: { isActive: true },
      include: {
        translations: true,
        _count: { select: { products: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return brands.map((brand) => ({
      id: brand.id,
      slug: brand.slug,
      name: brand.name,
      country: brand.country,
      logoUrl: brand.logoUrl ? this.mediaUrl(brand.logoUrl) : null,
      description: pickTranslation(brand.translations, locale)?.description ?? null,
      productCount: brand._count.products,
    }));
  }

  async getBrand(slug: string, locale: Locale): Promise<BrandDto> {
    const brand = (await this.listBrands(locale)).find((b) => b.slug === slug);
    if (!brand) throw AppException.notFound(ErrorCode.NOT_FOUND, '找不到這個品牌');
    return brand;
  }

  /** 分類樹（父分類的商品數包含子分類） */
  async listCategories(locale: Locale): Promise<CategoryDto[]> {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      include: {
        translations: true,
        _count: { select: { products: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
    });

    const nodes = new Map<string, CategoryDto>(
      categories.map((category) => {
        const t = pickTranslation(category.translations, locale);
        return [
          category.id,
          {
            id: category.id,
            slug: category.slug,
            name: t?.name ?? category.slug,
            description: t?.description ?? null,
            parentId: category.parentId,
            productCount: category._count.products,
            children: [],
          },
        ];
      }),
    );

    const roots: CategoryDto[] = [];
    for (const node of nodes.values()) {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;
      if (parent) {
        parent.children.push(node);
        parent.productCount += node.productCount;
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async listScales(): Promise<ScaleOptionDto[]> {
    const groups = await this.prisma.product.groupBy({
      by: ['scale'],
      where: { status: 'ACTIVE' },
      _count: { _all: true },
      orderBy: { scale: 'asc' },
    });
    return groups.map((g) => ({ scale: g.scale, productCount: g._count._all }));
  }

  async listProducts(
    query: ProductListQueryDto,
    locale: Locale,
    memberId?: string,
  ): Promise<ProductListDto> {
    const where = await this.buildWhere(query);
    const tier = await this.memberTier(memberId);
    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: productSummaryInclude,
        orderBy: this.buildOrderBy(query.sort ?? 'newest'),
        ...skipTake(query),
      }),
    ]);
    return {
      data: products.map((product) => this.toSummary(product, locale, new Date(), tier)),
      meta: pageMeta(query.page, query.pageSize, total),
    };
  }

  async getProduct(slug: string, locale: Locale, memberId?: string): Promise<ProductDetailDto> {
    const [product, tier] = await Promise.all([
      this.prisma.product.findFirst({
        where: { slug, status: 'ACTIVE' },
        include: productDetailInclude,
      }),
      this.memberTier(memberId),
    ]);
    if (!product) throw AppException.notFound(ErrorCode.PRODUCT_NOT_FOUND, '找不到這個商品');

    const t = pickTranslation(product.translations, locale);
    return {
      ...this.toSummary(product, locale, new Date(), tier),
      description: t?.description ?? '',
      specs: (product.specs as Record<string, string> | null) ?? {},
      images: product.images.map((image) => ({ url: this.mediaUrl(image.url), alt: image.alt })),
      purchaseLimit: product.purchaseLimit,
      preorderClosesAt: product.preorderClosesAt,
      expectedShipAt: product.expectedShipAt,
    };
  }

  /** 登入會員的等級（決定優先購資格）；未登入為 undefined */
  async memberTier(memberId?: string): Promise<MemberTier | undefined> {
    if (!memberId) return undefined;
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { tier: true, status: true },
    });
    return member?.status === 'ACTIVE' ? member.tier : undefined;
  }

  toSummary(
    product: ProductWithSummary,
    locale: Locale,
    now = new Date(),
    tier?: MemberTier,
  ): ProductSummaryDto {
    const t = pickTranslation(product.translations, locale);
    const categoryT = pickTranslation(product.category.translations, locale);
    const availability = computeAvailability(product, now, tier);
    const image = product.images[0];
    return {
      id: product.id,
      slug: product.slug,
      sku: product.sku,
      name: t?.name ?? product.sku,
      subtitle: t?.subtitle ?? null,
      brand: { id: product.brand.id, slug: product.brand.slug, name: product.brand.name },
      category: {
        id: product.category.id,
        slug: product.category.slug,
        name: categoryT?.name ?? product.category.slug,
      },
      scale: product.scale,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      saleType: product.saleType,
      releaseAt: product.releaseAt,
      earlyAccessTier: product.earlyAccessTier,
      earlyAccessAt: product.earlyAccessAt,
      availability,
      remaining:
        availability === Availability.LOW_STOCK ||
        (availability === Availability.PREORDER_OPEN && product.stock <= LOW_STOCK_THRESHOLD)
          ? product.stock
          : null,
      imageUrl: image ? this.mediaUrl(image.url) : null,
      isFeatured: product.isFeatured,
    };
  }

  mediaUrl(url: string): string {
    return toPublicUrl(url, this.config.API_PUBLIC_URL);
  }

  private async buildWhere(query: ProductListQueryDto): Promise<Prisma.ProductWhereInput> {
    const and: Prisma.ProductWhereInput[] = [{ status: 'ACTIVE' }];

    if (query.q?.trim()) {
      const q = query.q.trim();
      and.push({
        OR: [
          { translations: { some: { name: { contains: q, mode: 'insensitive' } } } },
          { sku: { contains: q, mode: 'insensitive' } },
          { brand: { name: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }
    if (query.brand) and.push({ brand: { slug: query.brand } });
    if (query.category) {
      const category = await this.prisma.category.findUnique({
        where: { slug: query.category },
        select: { id: true, children: { select: { id: true } } },
      });
      const ids = category ? [category.id, ...category.children.map((c) => c.id)] : [];
      and.push({ categoryId: { in: ids } });
    }
    if (query.scale) and.push({ scale: query.scale });
    if (query.saleType) and.push({ saleType: query.saleType });
    if (query.minPrice !== undefined) and.push({ price: { gte: query.minPrice } });
    if (query.maxPrice !== undefined) and.push({ price: { lte: query.maxPrice } });
    if (query.availability) and.push(availabilityWhere(query.availability, new Date()));

    return { AND: and };
  }

  private buildOrderBy(sort: ProductSort): Prisma.ProductOrderByWithRelationInput[] {
    switch (sort) {
      case 'price_asc':
        return [{ price: 'asc' }, { id: 'asc' }];
      case 'price_desc':
        return [{ price: 'desc' }, { id: 'asc' }];
      case 'release':
        return [{ releaseAt: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }];
      case 'featured':
        return [{ isFeatured: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }];
      case 'newest':
      default:
        return [{ createdAt: 'desc' }, { id: 'asc' }];
    }
  }
}

/** 與 computeAvailability 對應的資料庫查詢條件 */
export function availabilityWhere(filter: AvailabilityFilter, now: Date): Prisma.ProductWhereInput {
  const released: Prisma.ProductWhereInput = {
    OR: [{ releaseAt: null }, { releaseAt: { lte: now } }],
  };
  const preorderOpen: Prisma.ProductWhereInput = {
    OR: [{ preorderClosesAt: null }, { preorderClosesAt: { gt: now } }],
  };
  switch (filter) {
    case 'upcoming':
      return { releaseAt: { gt: now } };
    case 'preorder':
      return { AND: [{ saleType: 'PRE_ORDER' }, released, preorderOpen, { stock: { gt: 0 } }] };
    case 'sold_out':
      return { AND: [released, { stock: { lte: 0 } }] };
    case 'available':
    default:
      return {
        AND: [
          released,
          { stock: { gt: 0 } },
          { OR: [{ saleType: { not: 'PRE_ORDER' } }, preorderOpen] },
        ],
      };
  }
}
