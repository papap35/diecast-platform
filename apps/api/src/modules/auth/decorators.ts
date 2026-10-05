import {
  applyDecorators,
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AdminPrincipal, MemberPrincipal } from './auth.types.js';
import {
  AdminAuthGuard,
  MemberAuthGuard,
  OptionalMemberAuthGuard,
  PERMISSIONS_KEY,
} from './guards.js';
import type { Permission } from './permissions.js';

export const CurrentMember = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): MemberPrincipal | undefined =>
    ctx.switchToHttp().getRequest<Request>().member,
);

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminPrincipal | undefined =>
    ctx.switchToHttp().getRequest<Request>().admin,
);

export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** 需要會員登入 */
export const MemberAuth = () =>
  applyDecorators(UseGuards(MemberAuthGuard), ApiBearerAuth('member'));

/** 可選登入：公開 API 依登入狀態個人化 */
export const OptionalMemberAuth = () =>
  applyDecorators(UseGuards(OptionalMemberAuthGuard), ApiBearerAuth('member'));

/** 需要後台登入，可同時宣告所需權限 */
export const AdminAuth = (...permissions: Permission[]) =>
  applyDecorators(
    UseGuards(AdminAuthGuard),
    ...(permissions.length ? [RequirePermissions(...permissions)] : []),
    ApiBearerAuth('admin'),
  );
