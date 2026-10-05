import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { ClientInfo } from './token.service.js';

/** 取得呼叫端資訊（User-Agent、IP），記錄在登入工作階段方便追查 */
export const Client = createParamDecorator((_data: unknown, ctx: ExecutionContext): ClientInfo => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return { userAgent: req.headers['user-agent'], ip: req.ip };
});
