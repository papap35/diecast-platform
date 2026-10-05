import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/config.module.js';
import { pageMeta, type PaginationQuery, skipTake } from '../../common/http/pagination.dto.js';
import { isLocale, type Locale } from '../../common/i18n/locale.js';
import type { NotificationType, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { NotificationListDto } from './dto/notification.dto.js';
import { type NotificationParams, renderNotification } from './notification-templates.js';

type Db = Prisma.TransactionClient;

export interface NotifyInput {
  memberId: string;
  type: NotificationType;
  /** 需要依語系決定的參數（例如商品名稱、時間）可傳入函式 */
  params: NotificationParams | ((locale: Locale) => NotificationParams);
  /** 前台路徑（不含語系） */
  link?: string;
}

/**
 * 站內通知與 Email。
 * notify() 在呼叫端的交易內寫入通知與 Email 外寄匣：交易回滾就不會發出通知，
 * 寄信則由 EmailOutboxService 排程處理，寄信失敗不影響訂單等業務資料。
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async notify(db: Db, input: NotifyInput): Promise<void> {
    const member = await db.member.findUnique({
      where: { id: input.memberId },
      select: { email: true, locale: true, status: true },
    });
    if (!member || member.status !== 'ACTIVE') return;
    const locale: Locale = isLocale(member.locale) ? member.locale : 'zh-TW';
    const params = typeof input.params === 'function' ? input.params(locale) : input.params;
    const content = renderNotification(input.type, locale, params);
    const notification = await db.notification.create({
      data: {
        memberId: input.memberId,
        type: input.type,
        title: content.title,
        body: content.body,
        link: input.link ?? null,
      },
    });
    const url = input.link ? `${this.config.WEB_BASE_URL}/${locale}${input.link}` : null;
    await db.emailMessage.create({
      data: {
        to: member.email,
        subject: `[Paddock 64] ${content.title}`,
        text: [content.body, url, FOOTER[locale]].filter(Boolean).join('\n\n'),
        notificationId: notification.id,
      },
    });
  }

  async list(memberId: string, query: PaginationQuery): Promise<NotificationListDto> {
    const [total, unreadCount, rows] = await this.prisma.$transaction([
      this.prisma.notification.count({ where: { memberId } }),
      this.prisma.notification.count({ where: { memberId, readAt: null } }),
      this.prisma.notification.findMany({
        where: { memberId },
        // 同一個交易內建立的通知時間相同，再以 id（UUIDv7）排序讓分頁穩定
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...skipTake(query),
      }),
    ]);
    return {
      data: rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        link: row.link,
        readAt: row.readAt,
        createdAt: row.createdAt,
      })),
      meta: pageMeta(query.page, query.pageSize, total),
      unreadCount,
    };
  }

  unreadCount(memberId: string): Promise<number> {
    return this.prisma.notification.count({ where: { memberId, readAt: null } });
  }

  async markRead(memberId: string, ids?: string[]): Promise<number> {
    const { count } = await this.prisma.notification.updateMany({
      where: { memberId, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
    return count;
  }
}

const FOOTER: Record<Locale, string> = {
  'zh-TW': '— Paddock 64（作品集示範站，所有交易皆為模擬）',
  en: '— Paddock 64 (a portfolio demo; all transactions are simulated)',
  'zh-CN': '— Paddock 64（作品集示范站，所有交易皆为模拟）',
};
