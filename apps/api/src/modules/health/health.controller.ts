import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { RedisService } from '../../infra/redis/redis.service.js';

export class HealthDto {
  status!: 'ok' | 'degraded';
  database!: boolean;
  redis!: boolean;
  timestamp!: string;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** 部署平台用的健康檢查：資料庫與 Redis 都正常才回 200 */
  @Get()
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthDto> {
    const [database, redis] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      this.redis
        .ping()
        .then((pong) => pong === 'PONG')
        .catch(() => false),
    ]);
    const ok = database && redis;
    if (!ok) res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status: ok ? 'ok' : 'degraded', database, redis, timestamp: new Date().toISOString() };
  }
}
