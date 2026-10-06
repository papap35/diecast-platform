import { Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { pageMeta, skipTake } from '../../common/http/pagination.dto.js';
import { assertDateRange } from '../../common/validation/date-range.js';
import { pickTranslation } from '../../common/i18n/locale.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { assertHasDefaultTranslation } from '../catalog/admin-products.service.js';
import type {
  AdminEventDto,
  AdminEventListDto,
  AdminEventListItemDto,
  AdminEventQueryDto,
  CreateEventDto,
  UpdateEventDto,
} from './dto/content.dto.js';

const adminEventInclude = {
  translations: true,
  product: {
    select: {
      id: true,
      sku: true,
      translations: { where: { locale: 'zh-TW' }, select: { name: true } },
    },
  },
} satisfies Prisma.EventInclude;

type AdminEventRecord = Prisma.EventGetPayload<{ include: typeof adminEventInclude }>;

function toListItem(event: AdminEventRecord): AdminEventListItemDto {
  return {
    id: event.id,
    slug: event.slug,
    type: event.type,
    status: event.status,
    title: pickTranslation(event.translations, 'zh-TW')?.title ?? event.slug,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    venue: event.venue,
    product: event.product
      ? {
          id: event.product.id,
          sku: event.product.sku,
          name: event.product.translations[0]?.name ?? event.product.sku,
        }
      : null,
    updatedAt: event.updatedAt,
  };
}

function toDto(event: AdminEventRecord): AdminEventDto {
  return {
    ...toListItem(event),
    address: event.address,
    url: event.url,
    coverImageUrl: event.coverImageUrl,
    productId: event.productId,
    translations: event.translations.map((t) => ({
      locale: t.locale,
      title: t.title,
      summary: t.summary,
      body: t.body,
    })),
    createdAt: event.createdAt,
  };
}

const trimOrNull = (value: string | null | undefined) =>
  value === undefined ? undefined : value?.trim() || null;

/** 後台活動管理（前台只看得到已發布的活動，見 EventsService） */
@Injectable()
export class AdminEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminEventQueryDto): Promise<AdminEventListDto> {
    const q = query.q?.trim();
    const where: Prisma.EventWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(q
        ? {
            OR: [
              { slug: { contains: q, mode: 'insensitive' } },
              { translations: { some: { title: { contains: q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const [total, events] = await this.prisma.$transaction([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        include: adminEventInclude,
        orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
        ...skipTake(query),
      }),
    ]);
    return { data: events.map(toListItem), meta: pageMeta(query.page, query.pageSize, total) };
  }

  async get(id: string): Promise<AdminEventDto> {
    return toDto(await this.findOrThrow(id));
  }

  async create(dto: CreateEventDto): Promise<AdminEventDto> {
    assertHasDefaultTranslation(dto.translations);
    assertDateRange(dto.startsAt, dto.endsAt);
    await this.assertProduct(dto.productId);
    const event = await this.prisma.event.create({
      data: {
        slug: dto.slug,
        type: dto.type,
        status: dto.status,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt ?? null,
        venue: trimOrNull(dto.venue) ?? null,
        address: trimOrNull(dto.address) ?? null,
        url: trimOrNull(dto.url) ?? null,
        coverImageUrl: trimOrNull(dto.coverImageUrl) ?? null,
        productId: dto.productId ?? null,
        translations: { create: dto.translations.map(cleanTranslation) },
      },
      include: adminEventInclude,
    });
    return toDto(event);
  }

  async update(id: string, dto: UpdateEventDto): Promise<AdminEventDto> {
    const existing = await this.findOrThrow(id);
    assertHasDefaultTranslation(dto.translations);
    assertDateRange(
      dto.startsAt ?? existing.startsAt,
      dto.endsAt === undefined ? existing.endsAt : dto.endsAt,
    );
    if (dto.productId) await this.assertProduct(dto.productId);
    const event = await this.prisma.$transaction(async (tx) => {
      if (dto.translations) {
        await tx.eventTranslation.deleteMany({ where: { eventId: id } });
      }
      return tx.event.update({
        where: { id },
        data: {
          slug: dto.slug,
          type: dto.type,
          status: dto.status,
          startsAt: dto.startsAt,
          endsAt: dto.endsAt,
          venue: trimOrNull(dto.venue),
          address: trimOrNull(dto.address),
          url: trimOrNull(dto.url),
          coverImageUrl: trimOrNull(dto.coverImageUrl),
          productId: dto.productId,
          ...(dto.translations
            ? { translations: { create: dto.translations.map(cleanTranslation) } }
            : {}),
        },
        include: adminEventInclude,
      });
    });
    return toDto(event);
  }

  async remove(id: string): Promise<void> {
    await this.findOrThrow(id);
    await this.prisma.event.delete({ where: { id } });
  }

  private async findOrThrow(id: string): Promise<AdminEventRecord> {
    const event = await this.prisma.event.findUnique({ where: { id }, include: adminEventInclude });
    if (!event) throw AppException.notFound(ErrorCode.NOT_FOUND, '找不到這個活動');
    return event;
  }

  private async assertProduct(productId: string | null | undefined): Promise<void> {
    if (!productId) return;
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, '找不到關聯的商品', [
        { field: 'productId', messages: ['找不到這個商品'] },
      ]);
    }
  }
}

function cleanTranslation(t: { locale: string; title: string; summary: string; body: string }) {
  return {
    locale: t.locale,
    title: t.title.trim(),
    summary: t.summary.trim(),
    body: t.body.trim(),
  };
}
