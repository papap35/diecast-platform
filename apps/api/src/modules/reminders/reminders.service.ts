import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { APP_CONFIG, type AppConfig } from '../../config/config.module.js';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { type Locale, pickTranslation } from '../../common/i18n/locale.js';
import type { MemberTier } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { RedisService } from '../../infra/redis/redis.service.js';
import { CatalogService, productSummaryInclude } from '../catalog/catalog.service.js';
import { meetsTier } from '../members/tiers.js';
import { formatNotificationTime } from '../notifications/notification-templates.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { ReminderListDto } from './dto/reminder.dto.js';

/** 開賣前多久提醒 */
export const REMINDER_LEAD_MS = 15 * 60_000;

interface Schedule {
  releaseAt: Date | null;
  earlyAccessAt: Date | null;
  earlyAccessTier: MemberTier | null;
}

/** 這位會員可以開始購買的時間：符合優先購資格者為優先購開始，其餘為正式開賣 */
export function startsFor(product: Schedule, tier: MemberTier | undefined): Date | null {
  if (product.earlyAccessAt && product.earlyAccessTier && meetsTier(tier, product.earlyAccessTier)) {
    return product.earlyAccessAt;
  }
  return product.releaseAt;
}

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly catalog: CatalogService,
    private readonly notifications: NotificationsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async list(memberId: string, locale: Locale): Promise<ReminderListDto> {
    const [reminders, tier] = await Promise.all([
      this.prisma.releaseReminder.findMany({
        where: { memberId, product: { status: 'ACTIVE', releaseAt: { gt: new Date() } } },
        include: { product: { include: productSummaryInclude } },
      }),
      this.catalog.memberTier(memberId),
    ]);
    const now = new Date();
    return {
      data: reminders
        .map((reminder) => ({
          product: this.catalog.toSummary(reminder.product, locale, now, tier),
          remindAt: new Date(startsFor(reminder.product, tier)!.getTime() - REMINDER_LEAD_MS),
          notifiedAt: reminder.notifiedAt,
        }))
        .sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime()),
    };
  }

  async ids(memberId: string): Promise<string[]> {
    const reminders = await this.prisma.releaseReminder.findMany({
      where: { memberId, product: { releaseAt: { gt: new Date() } } },
      select: { productId: true },
    });
    return reminders.map((reminder) => reminder.productId);
  }

  /** 設定發售提醒：只有尚未開賣的商品可以設定 */
  async add(memberId: string, productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { status: true, releaseAt: true },
    });
    if (product?.status !== 'ACTIVE') {
      throw AppException.notFound(ErrorCode.PRODUCT_NOT_FOUND, '找不到這個商品');
    }
    if (!product.releaseAt || product.releaseAt <= new Date()) {
      throw AppException.conflict(ErrorCode.REMINDER_NOT_AVAILABLE, '商品已開賣或沒有開賣時間');
    }
    await this.prisma.releaseReminder.upsert({
      where: { memberId_productId: { memberId, productId } },
      create: { memberId, productId },
      update: {},
    });
  }

  async remove(memberId: string, productId: string): Promise<void> {
    await this.prisma.releaseReminder.deleteMany({ where: { memberId, productId } });
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'release-reminders' })
  async handleCron(): Promise<void> {
    if (this.config.NODE_ENV === 'test') return;
    const acquired = await this.redis
      .set('lock:release-reminders', '1', 'EX', 50, 'NX')
      .catch(() => null);
    if (acquired !== 'OK') return;
    const sent = await this.sendDue();
    if (sent > 0) this.logger.log(`已發出 ${sent} 則發售提醒`);
  }

  /** 發出到期的提醒（每位會員依自己的開始時間），回傳發出則數 */
  async sendDue(now: Date = new Date()): Promise<number> {
    const horizon = new Date(now.getTime() + REMINDER_LEAD_MS);
    const due = await this.prisma.releaseReminder.findMany({
      where: {
        notifiedAt: null,
        member: { status: 'ACTIVE' },
        product: {
          status: 'ACTIVE',
          releaseAt: { gt: new Date(now.getTime() - 60 * 60_000) },
          OR: [{ releaseAt: { lte: horizon } }, { earlyAccessAt: { lte: horizon } }],
        },
      },
      include: {
        member: { select: { tier: true } },
        product: { include: { translations: true } },
      },
      take: 500,
    });
    let sent = 0;
    for (const reminder of due) {
      const { product } = reminder;
      const startsAt = startsFor(product, reminder.member.tier);
      if (!startsAt || startsAt.getTime() - REMINDER_LEAD_MS > now.getTime()) continue;
      const early = startsAt.getTime() !== product.releaseAt?.getTime();
      await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.releaseReminder.updateMany({
          where: { memberId: reminder.memberId, productId: reminder.productId, notifiedAt: null },
          data: { notifiedAt: now },
        });
        if (count === 0) return;
        await this.notifications.notify(tx, {
          memberId: reminder.memberId,
          type: 'RELEASE_REMINDER',
          params: (locale) => ({
            product: pickTranslation(product.translations, locale)?.name ?? product.sku,
            time: formatNotificationTime(startsAt, locale),
            early,
            tier: product.earlyAccessTier ?? undefined,
          }),
          link: `/products/${product.slug}`,
        });
        sent += 1;
      });
    }
    return sent;
  }
}
