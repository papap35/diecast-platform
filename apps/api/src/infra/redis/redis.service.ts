import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { APP_CONFIG, type AppConfig } from '../../config/config.module.js';

/**
 * 共用的 Redis 連線。lazyConnect：第一次下指令才連線，
 * 讓產生 OpenAPI 文件等不需要 Redis 的流程可以在沒有 Redis 的環境執行。
 */
@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super(config.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 });
    this.on('error', (error: Error) => this.logger.error(`Redis 錯誤：${error.message}`));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.status !== 'end' && this.status !== 'wait') {
      await this.quit();
    }
  }
}
