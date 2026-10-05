import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { APP_CONFIG, type AppConfig } from '../../config/config.module.js';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { ProviderError } from '../../common/errors/provider-error.js';
import type { IntegrationProvider, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { RedisService } from '../../infra/redis/redis.service.js';
import { canVoidInvoice } from './ecpay-invoice.js';
import { toInvoiceOrder } from './invoice-lifecycle.js';
import type { InvoiceProvider, IssuedInvoice } from './invoice-provider.js';
import { EcpayInvoiceProvider } from './providers/ecpay-invoice.provider.js';
import { MockInvoiceProvider } from './providers/mock-invoice.js';

/** 自動重試上限；超過後停止重試，訂單事件會提示人工處理 */
export const MAX_INVOICE_ATTEMPTS = 6;

/** 重試間隔：1、2、4、8、16 分鐘 */
export function retryDelayMs(attempts: number): number {
  return Math.min(2 ** (attempts - 1), 30) * 60_000;
}

const invoiceInclude = {
  order: { include: { items: { orderBy: { id: 'asc' } } } },
} satisfies Prisma.InvoiceInclude;

type InvoiceWithOrder = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

/**
 * 電子發票：付款成功後由排程開立，退款時當期作廢、跨期開立折讓。
 * 呼叫加值中心不放在訂單交易內 —— 外部服務變慢或失敗不影響付款與訂單狀態，失敗依退避間隔重試。
 */
@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mock: MockInvoiceProvider,
    private readonly ecpay: EcpayInvoiceProvider,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** 發票一律由開立時的加值中心處理後續作廢或折讓，即使之後切換了設定 */
  private providerFor(name: IntegrationProvider): InvoiceProvider {
    return name === 'ECPAY' ? this.ecpay : this.mock;
  }

  @Cron(CronExpression.EVERY_30_SECONDS, { name: 'process-invoices' })
  async handleCron(): Promise<void> {
    if (this.config.NODE_ENV === 'test') return;
    const acquired = await this.redis
      .set('lock:process-invoices', '1', 'EX', 25, 'NX')
      .catch(() => null);
    if (acquired !== 'OK') return;
    const processed = await this.processDue();
    if (processed > 0) this.logger.log(`已處理 ${processed} 張電子發票`);
  }

  /** 處理到期的開立與作廢／折讓，回傳成功張數 */
  async processDue(now: Date = new Date()): Promise<number> {
    const due = await this.prisma.invoice.findMany({
      where: {
        status: { in: ['PENDING', 'VOID_PENDING'] },
        attempts: { lt: MAX_INVOICE_ATTEMPTS },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    let processed = 0;
    for (const { id } of due) {
      if (await this.process(id, now)) processed += 1;
    }
    return processed;
  }

  /** 後台手動重試：重設重試次數並立即處理（失敗會繼續由排程重試） */
  async retry(orderId: string, adminId: string): Promise<void> {
    const invoice = await this.prisma.invoice.findUnique({ where: { orderId } });
    if (!invoice || (invoice.status !== 'PENDING' && invoice.status !== 'VOID_PENDING')) {
      throw AppException.conflict(
        ErrorCode.INVOICE_NOT_RETRYABLE,
        '這張發票目前沒有待處理的開立或作廢',
      );
    }
    await this.prisma.$transaction([
      this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { attempts: 0, nextAttemptAt: null },
      }),
      this.prisma.orderEvent.create({
        data: {
          orderId,
          type: 'INVOICE_RETRY',
          actorType: 'ADMIN',
          actorId: adminId,
          message: '手動重試電子發票',
        },
      }),
    ]);
    await this.process(invoice.id);
  }

  /** 處理一張發票的待辦；以 Redis 鎖避免排程與手動重試同時處理同一張 */
  async process(id: string, now: Date = new Date()): Promise<boolean> {
    const lock = `lock:invoice:${id}`;
    if ((await this.redis.set(lock, '1', 'EX', 60, 'NX')) !== 'OK') return false;
    try {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id },
        include: invoiceInclude,
      });
      if (invoice?.status === 'PENDING') return await this.issue(invoice);
      if (invoice?.status === 'VOID_PENDING') return await this.reverse(invoice, now);
      return false;
    } finally {
      await this.redis.del(lock);
    }
  }

  private async issue(invoice: InvoiceWithOrder): Promise<boolean> {
    const provider = this.providerFor(invoice.provider);
    let issued: IssuedInvoice;
    try {
      // 前次嘗試失敗時可能其實已開立成功（逾時、程序中斷），先查詢，避免同一筆訂單開兩張
      const existing = invoice.lastError ? await provider.find(invoice.order.orderNo) : null;
      issued = existing ?? (await provider.issue(toInvoiceOrder(invoice.order)));
    } catch (error) {
      await this.recordFailure(invoice, error, '開立');
      return false;
    }

    const data = {
      invoiceNo: issued.invoiceNo,
      invoiceDate: issued.invoiceDate,
      randomNumber: issued.randomNumber,
      raw: issued.raw,
      lastError: null,
      nextAttemptAt: null,
    };
    const { count } = await this.prisma.invoice.updateMany({
      where: { id: invoice.id, status: 'PENDING' },
      data: { ...data, status: 'ISSUED', attempts: { increment: 1 } },
    });
    if (count === 0) {
      // 開立的同時訂單被退款（發票已標記不需開立）：剛開出的發票改排入作廢
      await this.prisma.invoice.updateMany({
        where: { id: invoice.id, status: 'CANCELLED' },
        data: { ...data, status: 'VOID_PENDING', attempts: 0 },
      });
    }
    await this.prisma.orderEvent.create({
      data: {
        orderId: invoice.orderId,
        type: 'INVOICE_ISSUED',
        actorType: 'SYSTEM',
        message: `電子發票已開立：${issued.invoiceNo}`,
      },
    });
    return true;
  }

  private async reverse(invoice: InvoiceWithOrder, now: Date): Promise<boolean> {
    if (!invoice.invoiceNo || !invoice.invoiceDate) {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'CANCELLED' },
      });
      return true;
    }
    const provider = this.providerFor(invoice.provider);
    const target = {
      invoiceNo: invoice.invoiceNo,
      invoiceDate: invoice.invoiceDate,
      order: toInvoiceOrder(invoice.order),
    };
    const voidable = canVoidInvoice(invoice.invoiceDate, now);
    try {
      if (voidable) {
        // 與開立相同：前次作廢失敗時可能其實已作廢，先確認狀態
        const existing = invoice.lastError ? await provider.find(invoice.order.orderNo) : null;
        if (!existing?.voided) await provider.void(target, '訂單退款');
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: 'VOIDED', reversedAt: now, lastError: null, nextAttemptAt: null },
        });
        await this.event(invoice.orderId, 'INVOICE_VOIDED', `電子發票已作廢：${invoice.invoiceNo}`);
      } else {
        const { allowanceNo } = await provider.allowance(target);
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: 'ALLOWANCE_ISSUED',
            allowanceNo,
            reversedAt: now,
            lastError: null,
            nextAttemptAt: null,
          },
        });
        await this.event(
          invoice.orderId,
          'INVOICE_ALLOWANCE',
          `跨期退款，已開立折讓單 ${allowanceNo}（發票 ${invoice.invoiceNo}）`,
        );
      }
      return true;
    } catch (error) {
      await this.recordFailure(invoice, error, voidable ? '作廢' : '折讓');
      return false;
    }
  }

  private async recordFailure(
    invoice: InvoiceWithOrder,
    error: unknown,
    action: string,
  ): Promise<void> {
    const attempts = invoice.attempts + 1;
    const message = error instanceof ProviderError ? error.message : '系統錯誤';
    if (!(error instanceof ProviderError)) this.logger.error(error);
    const exhausted = attempts >= MAX_INVOICE_ATTEMPTS;
    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        attempts,
        lastError: `${action}失敗：${message}`.slice(0, 500),
        nextAttemptAt: exhausted ? null : new Date(Date.now() + retryDelayMs(attempts)),
      },
    });
    this.logger.warn(
      `發票${action}失敗（${invoice.order.orderNo}，第 ${attempts} 次）：${message}`,
    );
    if (exhausted) {
      await this.event(
        invoice.orderId,
        'INVOICE_FAILED',
        `電子發票${action}已失敗 ${attempts} 次，停止自動重試，請人工處理：${message}`,
      );
    }
  }

  private async event(orderId: string, type: string, message: string): Promise<void> {
    await this.prisma.orderEvent.create({
      data: { orderId, type, actorType: 'SYSTEM', message },
    });
  }
}
