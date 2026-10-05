import { applyDecorators, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';
import { type Locale, resolveLocale, SUPPORTED_LOCALES } from './locale.js';

/** 解析請求語系：?locale= 優先，其次 Accept-Language，預設 zh-TW */
export const ReqLocale = createParamDecorator((_data: unknown, ctx: ExecutionContext): Locale => {
  const req = ctx.switchToHttp().getRequest<Request>();
  const explicit = typeof req.query.locale === 'string' ? req.query.locale : undefined;
  return resolveLocale(explicit, req.headers['accept-language']);
});

/** 在 Swagger 標示 locale 查詢參數（用於沒有 query DTO 的端點） */
export const ApiLocaleQuery = () =>
  applyDecorators(ApiQuery({ name: 'locale', required: false, enum: SUPPORTED_LOCALES }));
