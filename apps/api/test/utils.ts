import './test-env.js';
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/infra/prisma/prisma.service.js';
import { RedisService } from '../src/infra/redis/redis.service.js';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  redis: RedisService;
  http: () => ReturnType<typeof request>;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: ['error'] });
  configureApp(app);
  // 先在隨機埠啟動，避免 supertest 每個請求都重新 listen（大量併發測試時會觸發 MaxListeners 警告）
  await app.listen(0);
  const server = app.getHttpServer();
  return {
    app,
    prisma: app.get(PrismaService),
    redis: app.get(RedisService),
    http: () => request(server),
  };
}

/** 清空所有資料表（保留 schema），每個測試檔各自建立需要的資料 */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
