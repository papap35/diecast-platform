import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { APP_CONFIG, type AppConfig } from '../../config/config.module.js';
import type { EmailMessage } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { RedisService } from '../../infra/redis/redis.service.js';

export const MAX_EMAIL_ATTEMPTS = 5;

/** Email 外寄匣：排程把待寄信件交給寄信服務，失敗重試，超過上限標記失敗 */
@Injectable()
export class EmailOutboxService {
  private readonly logger = new Logger(EmailOutboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS, { name: 'send-emails' })
  async handleCron(): Promise<void> {
    if (this.config.NODE_ENV === 'test') return;
    const acquired = await this.redis
      .set('lock:send-emails', '1', 'EX', 25, 'NX')
      .catch(() => null);
    if (acquired !== 'OK') return;
    await this.sendPending();
  }

  /** 寄出待寄信件，回傳成功封數 */
  async sendPending(limit = 50): Promise<number> {
    const pending = await this.prisma.emailMessage.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    let sent = 0;
    for (const message of pending) {
      try {
        await this.deliver(message);
        await this.prisma.emailMessage.update({
          where: { id: message.id },
          data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 }, lastError: null },
        });
        sent += 1;
      } catch (error) {
        const attempts = message.attempts + 1;
        await this.prisma.emailMessage.update({
          where: { id: message.id },
          data: {
            attempts,
            lastError: (error as Error).message.slice(0, 500),
            status: attempts >= MAX_EMAIL_ATTEMPTS ? 'FAILED' : 'PENDING',
          },
        });
        this.logger.warn(`寄信失敗（${message.to}，第 ${attempts} 次）：${(error as Error).message}`);
      }
    }
    return sent;
  }

  private async deliver(message: EmailMessage): Promise<void> {
    if (this.config.EMAIL_PROVIDER === 'log') {
      this.logger.log(`[Email] → ${message.to}：${message.subject}`);
      return;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        // 外寄匣以信件 id 作為冪等鍵：重試不會寄出兩封
        'Idempotency-Key': message.id,
      },
      body: JSON.stringify({
        from: this.config.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}
