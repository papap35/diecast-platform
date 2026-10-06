import { Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { pageMeta, skipTake } from '../../common/http/pagination.dto.js';
import type { EmailMessage, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type {
  AdminEmailDto,
  AdminEmailListDto,
  AdminEmailListItemDto,
  AdminEmailQueryDto,
  EmailKind,
  RetryEmailsResultDto,
} from './dto/admin-email.dto.js';

const KIND_WHERE: Record<EmailKind, Prisma.EmailMessageWhereInput> = {
  NOTIFICATION: { notificationId: { not: null } },
  CAMPAIGN: { campaignId: { not: null } },
  OTHER: { notificationId: null, campaignId: null },
};

/** 後台寄信紀錄：查詢外寄匣、查看內容、把寄送失敗的信重新排入寄送 */
@Injectable()
export class AdminEmailsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminEmailQueryDto): Promise<AdminEmailListDto> {
    const q = query.q?.trim();
    const where: Prisma.EmailMessageWhereInput = {
      AND: [
        query.status ? { status: query.status } : {},
        query.kind ? KIND_WHERE[query.kind] : {},
        q
          ? {
              OR: [
                { to: { contains: q, mode: 'insensitive' } },
                { subject: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    };
    const [total, rows, counts] = await this.prisma.$transaction([
      this.prisma.emailMessage.count({ where }),
      this.prisma.emailMessage.findMany({
        where,
        // 列表不載入信件內容（電子報內容可能很長）
        omit: { text: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...skipTake(query),
      }),
      this.prisma.emailMessage.groupBy({
        by: ['status'],
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
    ]);
    const count = (status: string) =>
      counts.find((row) => row.status === status)?._count?._all ?? 0;
    return {
      data: rows.map(toListItem),
      meta: pageMeta(query.page, query.pageSize, total),
      stats: { pending: count('PENDING'), sent: count('SENT'), failed: count('FAILED') },
    };
  }

  async get(id: string): Promise<AdminEmailDto> {
    const message = await this.prisma.emailMessage.findUnique({
      where: { id },
      include: { campaign: { select: { id: true, name: true } } },
    });
    if (!message) throw AppException.notFound(ErrorCode.NOT_FOUND, '找不到這封信');
    const [member, notification] = await Promise.all([
      this.prisma.member.findUnique({ where: { email: message.to }, select: { id: true } }),
      message.notificationId
        ? this.prisma.notification.findUnique({
            where: { id: message.notificationId },
            select: { type: true },
          })
        : null,
    ]);
    return {
      ...toListItem(message),
      text: message.text,
      unsubscribeUrl: message.unsubscribeUrl,
      campaign: message.campaign,
      memberId: member?.id ?? null,
      notificationType: notification?.type ?? null,
    };
  }

  /** 寄送失敗的信重新排入外寄匣（重新計算 5 次重試），排程約 30 秒內寄出 */
  async retry(id: string): Promise<AdminEmailDto> {
    const { count } = await this.prisma.emailMessage.updateMany({
      where: { id, status: 'FAILED' },
      data: { status: 'PENDING', attempts: 0, nextAttemptAt: null },
    });
    if (count === 0) {
      const exists = await this.prisma.emailMessage.count({ where: { id } });
      if (!exists) throw AppException.notFound(ErrorCode.NOT_FOUND, '找不到這封信');
      throw AppException.conflict(ErrorCode.EMAIL_NOT_RETRYABLE, '只有寄送失敗的信可以重寄');
    }
    return this.get(id);
  }

  /** 全部寄送失敗的信重新排入（例如寄信服務故障排除後） */
  async retryFailed(): Promise<RetryEmailsResultDto> {
    const { count } = await this.prisma.emailMessage.updateMany({
      where: { status: 'FAILED' },
      data: { status: 'PENDING', attempts: 0, nextAttemptAt: null },
    });
    return { count };
  }
}

function kindOf(message: Pick<EmailMessage, 'notificationId' | 'campaignId'>): EmailKind {
  if (message.campaignId) return 'CAMPAIGN';
  return message.notificationId ? 'NOTIFICATION' : 'OTHER';
}

function toListItem(message: Omit<EmailMessage, 'text'>): AdminEmailListItemDto {
  return {
    id: message.id,
    to: message.to,
    subject: message.subject,
    kind: kindOf(message),
    status: message.status,
    attempts: message.attempts,
    nextAttemptAt: message.nextAttemptAt,
    lastError: message.lastError,
    sentAt: message.sentAt,
    createdAt: message.createdAt,
  };
}
