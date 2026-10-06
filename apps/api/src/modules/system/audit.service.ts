import { Injectable, Logger } from '@nestjs/common';
import { pageMeta, skipTake } from '../../common/http/pagination.dto.js';
import { taipeiDayRange } from '../../common/time/taipei.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { AuditTarget } from './audit.js';
import type { AuditLogListDto, AuditLogQueryDto } from './dto/system.dto.js';

export interface AuditEntry {
  adminId: string | null;
  action: string;
  targetType: AuditTarget;
  targetId?: string | null;
  targetLabel?: string | null;
  changes?: unknown;
  ip?: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 寫入操作紀錄；失敗只記錄錯誤，不影響已經完成的操作 */
  async record(entry: AuditEntry): Promise<void> {
    try {
      const targetId = entry.targetId ?? null;
      await this.prisma.auditLog.create({
        data: {
          adminId: entry.adminId,
          action: entry.action,
          targetType: entry.targetType,
          targetId,
          targetLabel: entry.targetLabel ?? (await this.lookupLabel(entry.targetType, targetId)),
          changes:
            entry.changes === undefined || entry.changes === null
              ? undefined
              : (entry.changes as Prisma.InputJsonValue),
          ip: entry.ip ?? null,
        },
      });
    } catch (error) {
      this.logger.error(`操作紀錄寫入失敗（${entry.action}）：${(error as Error).message}`);
    }
  }

  async list(query: AuditLogQueryDto): Promise<AuditLogListDto> {
    const createdAt = taipeiDayRange(query.from, query.to);
    const where: Prisma.AuditLogWhereInput = {
      ...(query.adminId ? { adminId: query.adminId } : {}),
      ...(query.action
        ? query.action.includes('.')
          ? { action: query.action }
          : { action: { startsWith: `${query.action}.` } }
        : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.targetId ? { targetId: query.targetId } : {}),
      ...(createdAt.gte || createdAt.lt ? { createdAt } : {}),
    };
    const [total, logs] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { admin: { select: { id: true, name: true, email: true } } },
        ...skipTake(query),
      }),
    ]);
    return {
      data: logs.map((log) => ({
        id: log.id,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        targetLabel: log.targetLabel,
        changes: (log.changes as Record<string, unknown> | null) ?? null,
        ip: log.ip,
        createdAt: log.createdAt,
        admin: log.admin,
      })),
      meta: pageMeta(query.page, query.pageSize, total),
    };
  }

  /** 回應沒有帶辨識文字時（例如變更訂單狀態），查一次資料庫補上 */
  private async lookupLabel(type: AuditTarget, id: string | null): Promise<string | null> {
    if (!id || !UUID.test(id)) return null;
    const select = { where: { id } } as const;
    switch (type) {
      case 'Order':
        return (
          (await this.prisma.order.findUnique({ ...select, select: { orderNo: true } }))?.orderNo ??
          null
        );
      case 'Member':
        return (
          (await this.prisma.member.findUnique({ ...select, select: { email: true } }))?.email ??
          null
        );
      case 'Product':
        return (
          (await this.prisma.product.findUnique({ ...select, select: { sku: true } }))?.sku ?? null
        );
      case 'AdminUser':
        return (
          (await this.prisma.adminUser.findUnique({ ...select, select: { email: true } }))?.email ??
          null
        );
      case 'Role':
        return (
          (await this.prisma.role.findUnique({ ...select, select: { name: true } }))?.name ?? null
        );
      default:
        return null;
    }
  }
}
