import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { APP_CONFIG, type AppConfig } from '../../config/config.module.js';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { pageMeta, skipTake } from '../../common/http/pagination.dto.js';
import { isLocale, type Locale, pickTranslation } from '../../common/i18n/locale.js';
import type { Campaign, MemberTier, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { RedisService } from '../../infra/redis/redis.service.js';
import { assertHasDefaultTranslation } from '../catalog/admin-products.service.js';
import { TIER_ORDER, tierRank } from '../members/tiers.js';
import type {
  CampaignDto,
  CampaignListDto,
  CampaignQueryDto,
  CampaignTranslationInput,
  CreateCampaignDto,
  ScheduleCampaignDto,
  TestCampaignDto,
  UpdateCampaignDto,
} from './dto/campaign.dto.js';
import { unsubscribeToken, verifyUnsubscribeToken } from './unsubscribe.js';

/** 每批寫入外寄匣的收件人數 */
const BATCH_SIZE = 500;

type CampaignWithTranslations = Campaign & {
  translations: { locale: string; subject: string; body: string }[];
};

const FOOTER: Record<Locale, (link: string) => string> = {
  'zh-TW': (link) =>
    `你收到這封信，是因為你在 Paddock 64 訂閱了新品與限量發售通知。\n不想再收到：${link}`,
  en: (link) =>
    `You're receiving this because you subscribed to new arrivals and drop alerts at Paddock 64.\nUnsubscribe: ${link}`,
  'zh-CN': (link) =>
    `你收到这封信，是因为你在 Paddock 64 订阅了新品与限量发售通知。\n不想再收到：${link}`,
};

/** 收件對象：帳號正常、同意接收行銷訊息，且等級達到門檻 */
function audienceWhere(minTier: MemberTier | null): Prisma.MemberWhereInput {
  return {
    status: 'ACTIVE',
    marketingOptIn: true,
    ...(minTier ? { tier: { in: TIER_ORDER.slice(tierRank(minTier)) as MemberTier[] } } : {}),
  };
}

function cleanTranslation(t: CampaignTranslationInput) {
  return { locale: t.locale, subject: t.subject.trim(), body: t.body.trim() };
}

/**
 * 電子報：草稿 → 排程 → 排程每分鐘把到期的電子報分批寫入 Email 外寄匣 → 外寄匣寄出。
 * 外寄匣對（電子報, 收件人）有唯一鍵，寫入中途中斷由下一輪接續，不會重複寄送。
 */
@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async list(query: CampaignQueryDto): Promise<CampaignListDto> {
    const where: Prisma.CampaignWhereInput = query.status ? { status: query.status } : {};
    const [total, campaigns] = await this.prisma.$transaction([
      this.prisma.campaign.count({ where }),
      this.prisma.campaign.findMany({
        where,
        include: { translations: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...skipTake(query),
      }),
    ]);
    return {
      data: await Promise.all(campaigns.map((campaign) => this.toDto(campaign))),
      meta: pageMeta(query.page, query.pageSize, total),
    };
  }

  async get(id: string): Promise<CampaignDto> {
    return this.toDto(await this.findOrThrow(id));
  }

  async create(dto: CreateCampaignDto): Promise<CampaignDto> {
    assertHasDefaultTranslation(dto.translations);
    const campaign = await this.prisma.campaign.create({
      data: {
        name: dto.name.trim(),
        minTier: dto.minTier ?? null,
        translations: { create: dto.translations.map(cleanTranslation) },
      },
      include: { translations: true },
    });
    return this.toDto(campaign);
  }

  async update(id: string, dto: UpdateCampaignDto): Promise<CampaignDto> {
    await this.findDraft(id);
    assertHasDefaultTranslation(dto.translations);
    const campaign = await this.prisma.$transaction(async (tx) => {
      if (dto.translations) await tx.campaignTranslation.deleteMany({ where: { campaignId: id } });
      return tx.campaign.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          minTier: dto.minTier,
          ...(dto.translations
            ? { translations: { create: dto.translations.map(cleanTranslation) } }
            : {}),
        },
        include: { translations: true },
      });
    });
    return this.toDto(campaign);
  }

  async remove(id: string): Promise<void> {
    await this.findDraft(id);
    await this.prisma.campaign.delete({ where: { id } });
  }

  /** 排程寄送（不指定時間或時間已過表示立即，排程最晚一分鐘內開始） */
  async schedule(id: string, dto: ScheduleCampaignDto): Promise<CampaignDto> {
    await this.findDraft(id);
    const now = new Date();
    const scheduledAt = dto.scheduledAt && dto.scheduledAt > now ? dto.scheduledAt : now;
    const { count } = await this.prisma.campaign.updateMany({
      where: { id, status: 'DRAFT' },
      data: { status: 'SCHEDULED', scheduledAt },
    });
    if (count === 0) throw this.notEditable();
    return this.get(id);
  }

  /** 取消排程（尚未開始寄送才可以），回到草稿 */
  async cancel(id: string): Promise<CampaignDto> {
    const { count } = await this.prisma.campaign.updateMany({
      where: { id, status: 'SCHEDULED' },
      data: { status: 'DRAFT', scheduledAt: null },
    });
    if (count === 0) {
      await this.findOrThrow(id);
      throw AppException.conflict(ErrorCode.CAMPAIGN_NOT_EDITABLE, '電子報已開始寄送，無法取消');
    }
    return this.get(id);
  }

  /** 寄一封測試信（主旨加上［測試］，不計入收件人數；退訂連結為示意） */
  async sendTest(id: string, dto: TestCampaignDto, admin: { email: string; name: string }) {
    const campaign = await this.findOrThrow(id);
    const locale = dto.locale ?? 'zh-TW';
    const { subject, text } = this.render(
      campaign,
      { name: admin.name, locale },
      '（測試信的退訂連結）',
    );
    await this.prisma.emailMessage.create({
      data: { to: dto.email ?? admin.email, subject: `［測試］${subject}`, text },
    });
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'send-campaigns' })
  async handleCron(): Promise<void> {
    if (this.config.NODE_ENV === 'test') return;
    const acquired = await this.redis
      .set('lock:send-campaigns', '1', 'EX', 55, 'NX')
      .catch(() => null);
    if (acquired !== 'OK') return;
    await this.processDue().catch((error: unknown) =>
      this.logger.error(`電子報寄送失敗：${(error as Error).message}`),
    );
  }

  /** 把到期的電子報（含上次中斷的）寫入外寄匣，回傳處理的電子報數 */
  async processDue(now = new Date()): Promise<number> {
    const due = await this.prisma.campaign.findMany({
      where: { OR: [{ status: 'SCHEDULED', scheduledAt: { lte: now } }, { status: 'SENDING' }] },
      include: { translations: true },
      orderBy: { scheduledAt: 'asc' },
    });
    for (const campaign of due) await this.dispatch(campaign);
    return due.length;
  }

  /** 會員點退訂連結（前台確認頁）或信箱服務的一鍵退訂 */
  async unsubscribe(token: string): Promise<void> {
    const memberId = verifyUnsubscribeToken(token, this.config.JWT_SECRET);
    if (!memberId) {
      throw AppException.badRequest(ErrorCode.UNSUBSCRIBE_INVALID, '退訂連結無效');
    }
    await this.prisma.member.updateMany({
      where: { id: memberId },
      data: { marketingOptIn: false },
    });
  }

  private async dispatch(campaign: CampaignWithTranslations): Promise<void> {
    await this.prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'SENDING', startedAt: campaign.startedAt ?? new Date() },
    });
    let cursor: string | undefined;
    for (;;) {
      const members = await this.prisma.member.findMany({
        where: audienceWhere(campaign.minTier),
        select: { id: true, email: true, name: true, locale: true },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (members.length === 0) break;
      await this.prisma.emailMessage.createMany({
        data: members.map((member) => {
          const token = unsubscribeToken(member.id, this.config.JWT_SECRET);
          const locale: Locale = isLocale(member.locale) ? member.locale : 'zh-TW';
          const pageUrl = `${this.config.WEB_BASE_URL}/${locale}/unsubscribe?token=${token}`;
          return {
            to: member.email,
            ...this.render(campaign, { name: member.name, locale }, pageUrl),
            campaignId: campaign.id,
            unsubscribeUrl: `${this.config.API_PUBLIC_URL}/v1/unsubscribe/one-click?token=${token}`,
          };
        }),
        skipDuplicates: true,
      });
      cursor = members.at(-1)!.id;
      if (members.length < BATCH_SIZE) break;
    }
    const recipientCount = await this.prisma.emailMessage.count({
      where: { campaignId: campaign.id },
    });
    await this.prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'SENT', sentAt: new Date(), recipientCount },
    });
    this.logger.log(`電子報「${campaign.name}」已寫入外寄匣：${recipientCount} 位收件人`);
  }

  /** 依會員語系挑內容（沒有就用繁中），帶入名稱並加上退訂說明 */
  private render(
    campaign: CampaignWithTranslations,
    member: { name: string; locale: Locale },
    unsubscribeLink: string,
  ): { subject: string; text: string } {
    const translation = pickTranslation(campaign.translations, member.locale)!;
    const footerLocale = isLocale(translation.locale) ? translation.locale : 'zh-TW';
    return {
      subject: translation.subject,
      text: `${translation.body.replaceAll('{{name}}', member.name)}\n\n—\n${FOOTER[footerLocale](unsubscribeLink)}`,
    };
  }

  private async toDto(campaign: CampaignWithTranslations): Promise<CampaignDto> {
    const draftLike = campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED';
    const [audienceCount, stats] = await Promise.all([
      draftLike
        ? this.prisma.member.count({ where: audienceWhere(campaign.minTier) })
        : Promise.resolve(campaign.recipientCount),
      this.prisma.emailMessage.groupBy({
        by: ['status'],
        where: { campaignId: campaign.id },
        _count: { _all: true },
      }),
    ]);
    const count = (status: string) => stats.find((row) => row.status === status)?._count._all ?? 0;
    return {
      id: campaign.id,
      name: campaign.name,
      subject: pickTranslation(campaign.translations, 'zh-TW')?.subject ?? '',
      status: campaign.status,
      minTier: campaign.minTier,
      scheduledAt: campaign.scheduledAt,
      startedAt: campaign.startedAt,
      sentAt: campaign.sentAt,
      audienceCount,
      stats: { pending: count('PENDING'), sent: count('SENT'), failed: count('FAILED') },
      translations: campaign.translations.map((t) => ({
        locale: t.locale,
        subject: t.subject,
        body: t.body,
      })),
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  }

  private async findOrThrow(id: string): Promise<CampaignWithTranslations> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { translations: true },
    });
    if (!campaign) throw AppException.notFound(ErrorCode.NOT_FOUND, '找不到這封電子報');
    return campaign;
  }

  private async findDraft(id: string): Promise<CampaignWithTranslations> {
    const campaign = await this.findOrThrow(id);
    if (campaign.status !== 'DRAFT') throw this.notEditable();
    return campaign;
  }

  private notEditable() {
    return AppException.conflict(
      ErrorCode.CAMPAIGN_NOT_EDITABLE,
      '電子報已排程或寄出，不能修改（排程中可先取消）',
    );
  }
}
