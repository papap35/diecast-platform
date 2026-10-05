import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import helmet from 'helmet';
import { APP_CONFIG, type AppConfig } from './config/config.module.js';
import { HttpExceptionFilter } from './common/errors/http-exception.filter.js';
import { createValidationPipe } from './common/errors/validation.js';

export const API_PREFIX = 'v1';

const DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:3001'];

/** main.ts、e2e 測試、OpenAPI 產生腳本共用同一份設定，確保行為一致 */
export function configureApp(app: INestApplication): AppConfig {
  const config = app.get<AppConfig>(APP_CONFIG);
  const express = app as NestExpressApplication;

  express.set('trust proxy', 1);
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({
    origin: config.CORS_ORIGINS.length ? config.CORS_ORIGINS : DEV_ORIGINS,
    credentials: true,
  });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  return config;
}

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle('Paddock 64 API')
    .setDescription(
      [
        '模型車收藏電商平台 API，供 Web 前台、Admin 後台與 iOS／Android App 共用。',
        '',
        '**認證**：`/v1/auth/*` 取得會員權杖、`/v1/admin/auth/*` 取得後台權杖，',
        '呼叫需要登入的 API 時帶上 `Authorization: Bearer <accessToken>`；access token 過期後以 refresh token 換發。',
        '',
        '**語系**：商品等內容 API 支援 `?locale=zh-TW|en|zh-CN`，未指定時依 `Accept-Language` 判斷。',
        '',
        '**錯誤格式**：所有錯誤皆為 `{ "error": { "code": "OUT_OF_STOCK", "message": "...", "details": ... } }`，',
        '請以 `code` 判斷錯誤類型。',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'member')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'admin')
    .build();

  return SwaggerModule.createDocument(app, builder, {
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });
}

export function setupSwagger(app: INestApplication): void {
  const document = buildOpenApiDocument(app);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs/openapi.json',
    customSiteTitle: 'Paddock 64 API Docs',
  });
}
