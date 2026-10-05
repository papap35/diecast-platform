import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { buildOpenApiDocument, configureApp } from '../app.setup.js';

// 產生 OpenAPI 規格不需要真的連資料庫，給預設值即可（Prisma 與 Redis 都是延遲連線）
process.env.DATABASE_URL ??= 'postgresql://openapi:openapi@localhost:5432/openapi';
process.env.JWT_SECRET ??= 'openapi-generation-placeholder-secret-0000';

const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
configureApp(app);
const document = buildOpenApiDocument(app);

const output = resolve(process.argv[2] ?? '../../packages/api-client/openapi.json');
writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`);
await app.close();
console.log(`OpenAPI 規格已寫入 ${output}`);
