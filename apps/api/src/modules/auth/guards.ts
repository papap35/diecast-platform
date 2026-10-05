import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { hasPermissions } from './permissions.js';
import { TokenService } from './token.service.js';
import './auth.types.js';

export const PERMISSIONS_KEY = 'required_permissions';

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/** 會員 API：驗證 access token（aud=member），通過後 req.member 可用 */
@Injectable()
export class MemberAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(req);
    if (!token) throw AppException.unauthorized();
    const payload = this.tokens.verifyAccessToken(token, 'member');
    req.member = { id: payload.sub };
    return true;
  }
}

/** 公開 API 的選擇性登入：有帶有效 token 就辨識會員（例如顯示是否已加入願望清單），沒有也放行 */
@Injectable()
export class OptionalMemberAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(req);
    if (token) {
      try {
        req.member = { id: this.tokens.verifyAccessToken(token, 'member').sub };
      } catch {
        req.member = undefined;
      }
    }
    return true;
  }
}

/**
 * 後台 API：驗證 access token（aud=admin），並每次從資料庫讀取最新角色權限，
 * 停用帳號或調整角色會立即生效，不必等 token 過期。
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(req);
    if (!token) throw AppException.unauthorized();
    const payload = this.tokens.verifyAccessToken(token, 'admin');

    const admin = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });
    if (!admin || !admin.isActive) {
      throw AppException.unauthorized(ErrorCode.ACCOUNT_DISABLED, '帳號已停用或不存在');
    }

    req.admin = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      roleKey: admin.role.key,
      permissions: admin.role.permissions,
    };

    const required =
      this.reflector.getAllAndOverride<string[] | undefined>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (!hasPermissions(admin.role.permissions, required)) {
      throw AppException.forbidden();
    }
    return true;
  }
}
