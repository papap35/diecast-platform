import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { APP_CONFIG, type AppConfig } from '../../config/config.module.js';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { type Locale, pickTranslation } from '../../common/i18n/locale.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { RedisService } from '../../infra/redis/redis.service.js';
import { computeAvailability, isPurchasable } from '../catalog/availability.js';
import { CatalogService, productSummaryInclude } from '../catalog/catalog.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { WishlistDto } from './dto/wishlist.dto.js';

export const WISHLIST_LIMIT = 200;

@Injectable()
export class WishlistService {
  private readonly logger = new Logger(WishlistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly catalog: CatalogService,
    private readonly notifications: NotificationsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async list(memberId: string, locale: Locale): Promise<WishlistDto> {
    const [items, tier] = await Promise.all([
      this.prisma.wishlistItem.findMany({
        where: { memberId, product: { status: 'ACTIVE' } },
        include: { product: { include: productSummaryInclude } },
        orderBy: { createdAt: 'desc' },
      }),
      this.catalog.memberTier(memberId),
    ]);
    const now = new Date();
    return {
      data: items.map((item) => ({
        product: this.catalog.toSummary(item.product, locale, now, tier),
        addedAt: item.createdAt,
      })),
    };
  }

  async ids(memberId: string): Promise<string[]> {
    const items = await this.prisma.wishlistItem.findMany({
      where: { memberId },
      select: { productId: true },
    });
    return items.map((item) => item.productId);
  }

  async add(memberId: string, productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { status: true },
    });
    if (product?.status !== 'ACTIVE') {
      throw AppException.notFound(ErrorCode.PRODUCT_NOT_FOUND, '找不到這個商品');
    }
    const count = await this.prisma.wishlistItem.count({ where: { memberId } });
    if (count >= WISHLIST_LIMIT) {
      throw AppException.conflict(ErrorCode.WISHLIST_FULL, `願望清單最多 ${WISHLIST_LIMIT} 件`);
    }
    await this.prisma.wishlistItem.upsert({
      where: { memberId_productId: { memberId, productId } },
      create: { memberId, productId },
      update: {},
    });
  }

  async remove(memberId: string, productId: string): Promise<void> {
    await this.prisma.wishlistItem.deleteMany({ where: { memberId, productId } });
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'wishlist-restock' })
  async handleRestockCron(): Promise<void> {
    if (this.config.NODE_ENV === 'test') return;
    const acquired = await this.redis
      .set('lock:wishlist-restock', '1', 'EX', 50, 'NX')
      .catch(() => null);
    if (acquired !== 'OK') return;
    const sent = await this.notifyRestocks();
    if (sent > 0) this.logger.log(`已發出 ${sent} 則補貨通知`);
  }

  /**
   * 補貨通知：商品從售完補回有貨（restockedAt），而會員是在售完期間加入、
   * 或上次通知之後又再次補貨，才通知 —— 加入時就有貨的不會收到。
   */
  async notifyRestocks(now: Date = new Date()): Promise<number> {
    const due = await this.prisma.$queryRaw<{ memberId: string; productId: string }[]>`
      SELECT w."memberId", w."productId"
      FROM "WishlistItem" w
      JOIN "Product" p ON p."id" = w."productId"
      JOIN "Member" m ON m."id" = w."memberId"
      WHERE p."restockedAt" IS NOT NULL
        AND p."restockedAt" > COALESCE(w."notifiedAt", w."createdAt")
        AND p."stock" > 0 AND p."status" = 'ACTIVE' AND m."status" = 'ACTIVE'
      ORDER BY p."restockedAt" ASC
      LIMIT 500`;
    if (due.length === 0) return 0;

    const products = await this.prisma.product.findMany({
      where: { id: { in: [...new Set(due.map((row) => row.productId))] } },
      include: { translations: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    let sent = 0;
    for (const { memberId, productId } of due) {
      const product = byId.get(productId);
      // 例如補貨後改成尚未開賣，就等真的能買時再通知
      if (!product || !isPurchasable(computeAvailability(product, now))) continue;
      await this.prisma.$transaction(async (tx) => {
        await this.notifications.notify(tx, {
          memberId,
          type: 'WISHLIST_RESTOCK',
          params: (locale) => ({
            product: pickTranslation(product.translations, locale)?.name ?? product.sku,
          }),
          link: `/products/${product.slug}`,
        });
        await tx.wishlistItem.update({
          where: { memberId_productId: { memberId, productId } },
          data: { notifiedAt: now },
        });
      });
      sent += 1;
    }
    return sent;
  }
}
