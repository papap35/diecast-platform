import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { mergeMap, type Observable } from 'rxjs';
import { AUDIT_KEY, type AuditMeta, idOf, labelOf, sanitizeForAudit } from './audit.js';
import { AuditService } from './audit.service.js';

/** 標了 @Audit 的 API 成功回應後寫入操作紀錄（失敗的請求不記錄） */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditMeta | undefined>(AUDIT_KEY, context.getHandler());
    if (!meta || context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<Request>();
    const params = req.params as Record<string, string | undefined>;

    return next.handle().pipe(
      mergeMap(async (result: unknown) => {
        const body = req.body as unknown;
        const hasBody = !!body && typeof body === 'object' && Object.keys(body).length > 0;
        await this.audit.record({
          adminId: req.admin?.id ?? null,
          action: meta.action,
          targetType: meta.target,
          targetId: params.id ?? idOf(result),
          targetLabel: labelOf(result) ?? labelOf(body),
          changes: hasBody ? sanitizeForAudit(body) : undefined,
          ip: req.ip ?? null,
        });
        return result;
      }),
    );
  }
}
