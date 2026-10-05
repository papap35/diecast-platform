import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/config.module.js';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { toPublicUrl } from '../../common/http/media.js';
import { pageMeta, skipTake } from '../../common/http/pagination.dto.js';
import { type Locale, pickTranslation } from '../../common/i18n/locale.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { CatalogService, productSummaryInclude } from '../catalog/catalog.service.js';
import type {
  EventDetailDto,
  EventListDto,
  EventListQueryDto,
  EventSummaryDto,
} from './dto/event.dto.js';

type EventWithTranslations = Prisma.EventGetPayload<{ include: { translations: true } }>;

/** 活動（車展、車聚、發售活動）：只公開已發布的活動 */
@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async list(query: EventListQueryDto, locale: Locale): Promise<EventListDto> {
    const from = query.from ?? new Date();
    const where: Prisma.EventWhereInput = {
      status: 'PUBLISHED',
      // 尚未結束：沒有結束時間的以開始時間判斷
      OR: [{ endsAt: { gte: from } }, { endsAt: null, startsAt: { gte: from } }],
      ...(query.to ? { startsAt: { lt: query.to } } : {}),
      ...(query.type ? { type: query.type } : {}),
    };
    const [total, events] = await this.prisma.$transaction([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        include: { translations: true },
        orderBy: { startsAt: 'asc' },
        ...skipTake(query),
      }),
    ]);
    return {
      data: events.map((event) => this.toSummary(event, locale)),
      meta: pageMeta(query.page, query.pageSize, total),
    };
  }

  async get(slug: string, locale: Locale): Promise<EventDetailDto> {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: { translations: true, product: { include: productSummaryInclude } },
    });
    if (event?.status !== 'PUBLISHED') {
      throw AppException.notFound(ErrorCode.NOT_FOUND, '找不到這個活動');
    }
    return {
      ...this.toSummary(event, locale),
      body: pickTranslation(event.translations, locale)?.body ?? '',
      product:
        event.product?.status === 'ACTIVE' ? this.catalog.toSummary(event.product, locale) : null,
    };
  }

  private toSummary(event: EventWithTranslations, locale: Locale): EventSummaryDto {
    const t = pickTranslation(event.translations, locale);
    return {
      id: event.id,
      slug: event.slug,
      type: event.type,
      title: t?.title ?? event.slug,
      summary: t?.summary ?? '',
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      venue: event.venue,
      address: event.address,
      url: event.url,
      coverImageUrl: event.coverImageUrl
        ? toPublicUrl(event.coverImageUrl, this.config.API_PUBLIC_URL)
        : null,
    };
  }
}
