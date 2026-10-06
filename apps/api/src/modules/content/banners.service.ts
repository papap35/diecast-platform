import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/config.module.js';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { toPublicUrl } from '../../common/http/media.js';
import { type Locale, pickTranslation } from '../../common/i18n/locale.js';
import type { BannerPlacement, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { assertHasDefaultTranslation } from '../catalog/admin-products.service.js';
import { assertDateRange } from './admin-events.service.js';
import type {
  AdminBannerDto,
  AdminBannerListDto,
  AdminBannerQueryDto,
  BannerDto,
  BannerState,
  BannerTranslationInput,
  CreateBannerDto,
  UpdateBannerDto,
} from './dto/content.dto.js';

/** 公告列出現在每一頁，記憶體快取 30 秒；後台修改後立即清除（多台時其他台最多晚 30 秒） */
const CACHE_TTL_MS = 30_000;

type BannerRecord = Prisma.BannerGetPayload<{ include: { translations: true } }>;

export function bannerState(
  banner: Pick<BannerRecord, 'status' | 'startsAt' | 'endsAt'>,
  now = new Date(),
): BannerState {
  if (banner.status === 'DRAFT') return 'DRAFT';
  if (banner.endsAt && banner.endsAt <= now) return 'ENDED';
  if (banner.startsAt && banner.startsAt > now) return 'SCHEDULED';
  return 'LIVE';
}

function toAdminDto(banner: BannerRecord, now: Date): AdminBannerDto {
  return {
    id: banner.id,
    placement: banner.placement,
    status: banner.status,
    state: bannerState(banner, now),
    theme: banner.theme,
    title: pickTranslation(banner.translations, 'zh-TW')?.title ?? '',
    linkUrl: banner.linkUrl,
    imageUrl: banner.imageUrl,
    startsAt: banner.startsAt,
    endsAt: banner.endsAt,
    sortOrder: banner.sortOrder,
    translations: banner.translations.map((t) => ({
      locale: t.locale,
      title: t.title,
      subtitle: t.subtitle,
      ctaLabel: t.ctaLabel,
    })),
    updatedAt: banner.updatedAt,
  };
}

function cleanTranslation(t: BannerTranslationInput) {
  return {
    locale: t.locale,
    title: t.title.trim(),
    subtitle: t.subtitle?.trim() || null,
    ctaLabel: t.ctaLabel?.trim() || null,
  };
}

@Injectable()
export class BannersService {
  private readonly cache = new Map<string, { data: BannerDto[]; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** 前台：已發布且在上架期間內的橫幅，依排序 */
  async live(placement: BannerPlacement, locale: Locale): Promise<BannerDto[]> {
    const key = `${placement}:${locale}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const now = new Date();
    const banners = await this.prisma.banner.findMany({
      where: {
        placement,
        status: 'PUBLISHED',
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      include: { translations: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    const data = banners.map((banner) => {
      const t = pickTranslation(banner.translations, locale);
      return {
        id: banner.id,
        placement: banner.placement,
        theme: banner.theme,
        title: t?.title ?? '',
        subtitle: t?.subtitle ?? null,
        ctaLabel: t?.ctaLabel ?? null,
        linkUrl: banner.linkUrl,
        imageUrl: banner.imageUrl ? toPublicUrl(banner.imageUrl, this.config.API_PUBLIC_URL) : null,
      };
    });
    this.cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  }

  async list(query: AdminBannerQueryDto): Promise<AdminBannerListDto> {
    const banners = await this.prisma.banner.findMany({
      where: query.placement ? { placement: query.placement } : {},
      include: { translations: true },
      orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    const now = new Date();
    return { data: banners.map((banner) => toAdminDto(banner, now)) };
  }

  async create(dto: CreateBannerDto): Promise<AdminBannerDto> {
    assertHasDefaultTranslation(dto.translations);
    assertDateRange(dto.startsAt, dto.endsAt);
    const banner = await this.prisma.banner.create({
      data: {
        placement: dto.placement,
        status: dto.status,
        theme: dto.theme,
        linkUrl: dto.linkUrl?.trim() || null,
        imageUrl: dto.imageUrl?.trim() || null,
        startsAt: dto.startsAt ?? null,
        endsAt: dto.endsAt ?? null,
        sortOrder: dto.sortOrder ?? 0,
        translations: { create: dto.translations.map(cleanTranslation) },
      },
      include: { translations: true },
    });
    this.cache.clear();
    return toAdminDto(banner, new Date());
  }

  async update(id: string, dto: UpdateBannerDto): Promise<AdminBannerDto> {
    const existing = await this.findOrThrow(id);
    assertHasDefaultTranslation(dto.translations);
    assertDateRange(
      dto.startsAt === undefined ? existing.startsAt : dto.startsAt,
      dto.endsAt === undefined ? existing.endsAt : dto.endsAt,
    );
    const banner = await this.prisma.$transaction(async (tx) => {
      if (dto.translations) await tx.bannerTranslation.deleteMany({ where: { bannerId: id } });
      return tx.banner.update({
        where: { id },
        data: {
          status: dto.status,
          theme: dto.theme,
          linkUrl: dto.linkUrl === undefined ? undefined : dto.linkUrl?.trim() || null,
          imageUrl: dto.imageUrl === undefined ? undefined : dto.imageUrl?.trim() || null,
          startsAt: dto.startsAt,
          endsAt: dto.endsAt,
          sortOrder: dto.sortOrder,
          ...(dto.translations
            ? { translations: { create: dto.translations.map(cleanTranslation) } }
            : {}),
        },
        include: { translations: true },
      });
    });
    this.cache.clear();
    return toAdminDto(banner, new Date());
  }

  async remove(id: string): Promise<void> {
    await this.findOrThrow(id);
    await this.prisma.banner.delete({ where: { id } });
    this.cache.clear();
  }

  private async findOrThrow(id: string): Promise<BannerRecord> {
    const banner = await this.prisma.banner.findUnique({
      where: { id },
      include: { translations: true },
    });
    if (!banner) throw AppException.notFound(ErrorCode.NOT_FOUND, '找不到這則橫幅');
    return banner;
  }
}
