import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/config.module.js';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { toPublicUrl } from '../../common/http/media.js';
import { type Locale, pickTranslation } from '../../common/i18n/locale.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type {
  CreateGarageItemDto,
  GarageDto,
  GarageItemDto,
  GarageSettingsDto,
  GarageStatsDto,
  PublicGarageDto,
  UpdateGarageItemDto,
  UpdateGarageSettingsDto,
} from './dto/garage.dto.js';

export const GARAGE_LIMIT = 500;

/** 公開車庫保留的代稱（避免與網站路徑或品牌混淆） */
const RESERVED_HANDLES = new Set(['admin', 'api', 'paddock64', 'garage', 'support', 'help']);

const garageInclude = {
  product: {
    select: {
      slug: true,
      status: true,
      translations: true,
      images: { orderBy: { sortOrder: 'asc' }, take: 1 },
    },
  },
} satisfies Prisma.GarageItemInclude;

type GarageRow = Prisma.GarageItemGetPayload<{ include: typeof garageInclude }>;

/**
 * 我的車庫：收藏的車款。本站訂單完成後自動入庫（見 garage-lifecycle.ts），
 * 會員也可以登錄其他來源的車款、記錄狀態與購入價，並選擇公開分享。
 */
@Injectable()
export class GarageService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async get(memberId: string, locale: Locale): Promise<GarageDto> {
    const [rows, member] = await Promise.all([
      this.prisma.garageItem.findMany({
        where: { memberId },
        include: garageInclude,
        orderBy: [{ isFavorite: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.member.findUniqueOrThrow({
        where: { id: memberId },
        select: { garagePublic: true, garageHandle: true },
      }),
    ]);
    const items = rows.map((row) => this.toDto(row, locale));
    return {
      items,
      stats: stats(items),
      totalPaid: items.reduce((sum, item) => sum + (item.pricePaid ?? 0) * item.quantity, 0),
      settings: { public: member.garagePublic, handle: member.garageHandle },
    };
  }

  async getPublic(handle: string, locale: Locale): Promise<PublicGarageDto> {
    const member = await this.prisma.member.findUnique({
      where: { garageHandle: handle.toLowerCase() },
      select: { id: true, tier: true, garagePublic: true, status: true },
    });
    if (!member?.garagePublic || member.status !== 'ACTIVE') {
      throw AppException.notFound(ErrorCode.NOT_FOUND, '找不到這個車庫');
    }
    const rows = await this.prisma.garageItem.findMany({
      where: { memberId: member.id },
      include: garageInclude,
      orderBy: [{ isFavorite: 'desc' }, { createdAt: 'desc' }],
    });
    const items = rows.map((row) => ({
      ...this.toDto(row, locale),
      pricePaid: null,
      note: null,
    }));
    return { handle: handle.toLowerCase(), tier: member.tier, items, stats: stats(items) };
  }

  async create(memberId: string, dto: CreateGarageItemDto, locale: Locale): Promise<GarageItemDto> {
    const count = await this.prisma.garageItem.count({ where: { memberId } });
    if (count >= GARAGE_LIMIT) {
      throw AppException.conflict(ErrorCode.GARAGE_FULL, `車庫最多 ${GARAGE_LIMIT} 筆`);
    }
    let snapshot: { name: string; brandName: string | null; scale: string | null } = {
      name: dto.name?.trim() ?? '',
      brandName: dto.brandName?.trim() || null,
      scale: dto.scale ?? null,
    };
    if (dto.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
        include: { translations: true, brand: { select: { name: true } } },
      });
      if (!product) throw AppException.notFound(ErrorCode.PRODUCT_NOT_FOUND, '找不到這個商品');
      snapshot = {
        name: pickTranslation(product.translations, locale)?.name ?? product.sku,
        brandName: product.brand.name,
        scale: product.scale,
      };
    }
    const row = await this.prisma.garageItem.create({
      data: {
        memberId,
        productId: dto.productId ?? null,
        ...snapshot,
        condition: dto.condition,
        quantity: dto.quantity,
        pricePaid: dto.pricePaid,
        acquiredAt: dto.acquiredAt,
        note: dto.note?.trim() || null,
        isFavorite: dto.isFavorite,
      },
      include: garageInclude,
    });
    return this.toDto(row, locale);
  }

  async update(
    memberId: string,
    id: string,
    dto: UpdateGarageItemDto,
    locale: Locale,
  ): Promise<GarageItemDto> {
    await this.findOwn(memberId, id);
    const row = await this.prisma.garageItem.update({
      where: { id },
      data: {
        condition: dto.condition,
        quantity: dto.quantity,
        pricePaid: dto.pricePaid,
        acquiredAt: dto.acquiredAt,
        note: dto.note === undefined ? undefined : dto.note?.trim() || null,
        isFavorite: dto.isFavorite,
      },
      include: garageInclude,
    });
    return this.toDto(row, locale);
  }

  async remove(memberId: string, id: string): Promise<void> {
    await this.findOwn(memberId, id);
    await this.prisma.garageItem.delete({ where: { id } });
  }

  async updateSettings(memberId: string, dto: UpdateGarageSettingsDto): Promise<GarageSettingsDto> {
    const handle = dto.handle?.toLowerCase();
    if (handle && RESERVED_HANDLES.has(handle)) {
      throw AppException.conflict(ErrorCode.GARAGE_HANDLE_TAKEN, '這個網址代稱無法使用');
    }
    try {
      const member = await this.prisma.member.update({
        where: { id: memberId },
        data: { garagePublic: dto.public, ...(handle ? { garageHandle: handle } : {}) },
        select: { garagePublic: true, garageHandle: true },
      });
      return { public: member.garagePublic, handle: member.garageHandle };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw AppException.conflict(ErrorCode.GARAGE_HANDLE_TAKEN, '這個網址代稱已經有人使用');
      }
      throw error;
    }
  }

  private async findOwn(memberId: string, id: string) {
    const item = await this.prisma.garageItem.findUnique({ where: { id }, select: { memberId: true } });
    if (!item || item.memberId !== memberId) {
      throw AppException.notFound(ErrorCode.NOT_FOUND, '找不到這台收藏');
    }
  }

  private toDto(row: GarageRow, locale: Locale): GarageItemDto {
    const product = row.product;
    const image = product?.images[0];
    return {
      id: row.id,
      productId: row.productId,
      // 已下架的商品不提供連結
      productSlug: product?.status === 'ACTIVE' ? product.slug : null,
      name: (product && pickTranslation(product.translations, locale)?.name) ?? row.name,
      brandName: row.brandName,
      scale: row.scale,
      imageUrl: image ? toPublicUrl(image.url, this.config.API_PUBLIC_URL) : null,
      condition: row.condition,
      quantity: row.quantity,
      pricePaid: row.pricePaid,
      acquiredAt: row.acquiredAt,
      note: row.note,
      isFavorite: row.isFavorite,
      source: row.orderItemId ? 'ORDER' : 'MANUAL',
      createdAt: row.createdAt,
    };
  }
}

function countBy(items: GarageItemDto[], key: (item: GarageItemDto) => string | null) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const label = key(item);
    if (label) counts.set(label, (counts.get(label) ?? 0) + item.quantity);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function stats(items: GarageItemDto[]): GarageStatsDto {
  return {
    models: items.length,
    cars: items.reduce((sum, item) => sum + item.quantity, 0),
    brands: countBy(items, (item) => item.brandName).slice(0, 8),
    scales: countBy(items, (item) => item.scale),
  };
}
