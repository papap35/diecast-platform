import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { assertNotDemoAccount } from '../../common/demo/demo-accounts.js';
import { APP_CONFIG, type AppConfig } from '../../config/config.module.js';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { verifyPassword, hashPassword } from '../../common/security/password.js';
import type { AdminUser, Role } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { AuditService } from '../system/audit.service.js';
import type { ChangeAdminPasswordDto } from '../system/dto/system.dto.js';
import type { AdminAuthResultDto, AdminLoginDto, AdminProfileDto } from './dto/admin-auth.dto.js';
import type { TokenPairDto } from './dto/token.dto.js';
import { normalizeEmail } from './member-auth.service.js';
import { type ClientInfo, TokenService } from './token.service.js';

const DUMMY_HASH = hashPassword('timing-safe-dummy-password');

export function toAdminProfile(admin: AdminUser & { role: Role }): AdminProfileDto {
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: {
      id: admin.role.id,
      key: admin.role.key,
      name: admin.role.name,
      permissions: admin.role.permissions,
    },
  };
}

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async login(dto: AdminLoginDto, client: ClientInfo): Promise<AdminAuthResultDto> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email: normalizeEmail(dto.email) },
      include: { role: true },
    });
    const valid = await verifyPassword(dto.password, admin?.passwordHash ?? (await DUMMY_HASH));
    if (!admin || !valid) {
      // 已存在的管理員帳號登入失敗才記錄（不存在的 Email 不寫，避免被灌爆）
      if (admin) await this.recordLogin(admin, 'auth.login_failed', client);
      throw new AppException(
        ErrorCode.INVALID_CREDENTIALS,
        'Email 或密碼錯誤',
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (!admin.isActive) {
      throw new AppException(ErrorCode.ACCOUNT_DISABLED, '帳號已停用', HttpStatus.FORBIDDEN);
    }

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });
    await this.recordLogin(admin, 'auth.login', client);
    return {
      admin: toAdminProfile(admin),
      tokens: await this.tokens.issue('ADMIN', admin.id, client),
    };
  }

  async refresh(refreshToken: string, client: ClientInfo): Promise<TokenPairDto> {
    const adminId = await this.tokens.findSubjectId('ADMIN', refreshToken);
    if (adminId) {
      const admin = await this.prisma.adminUser.findUnique({
        where: { id: adminId },
        select: { isActive: true },
      });
      if (!admin?.isActive) {
        await this.tokens.revokeAll('ADMIN', adminId);
        throw new AppException(ErrorCode.ACCOUNT_DISABLED, '帳號已停用', HttpStatus.FORBIDDEN);
      }
    }
    return this.tokens.rotate('ADMIN', refreshToken, client);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }

  /** 修改自己的密碼；所有裝置（含目前這個）都要重新登入 */
  async changePassword(
    adminId: string,
    dto: ChangeAdminPasswordDto,
    client: ClientInfo,
  ): Promise<void> {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
    assertNotDemoAccount(this.config, admin.email);
    if (!(await verifyPassword(dto.currentPassword, admin.passwordHash))) {
      throw AppException.badRequest(ErrorCode.INVALID_CREDENTIALS, '目前的密碼不正確');
    }
    await this.prisma.adminUser.update({
      where: { id: adminId },
      data: { passwordHash: await hashPassword(dto.newPassword), tokensValidAfter: new Date() },
    });
    await this.tokens.revokeAll('ADMIN', adminId);
    await this.audit.record({
      adminId,
      action: 'auth.password',
      targetType: 'AdminUser',
      targetId: adminId,
      targetLabel: admin.email,
      ip: client.ip ?? null,
    });
  }

  async me(adminId: string): Promise<AdminProfileDto> {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({
      where: { id: adminId },
      include: { role: true },
    });
    return toAdminProfile(admin);
  }

  private recordLogin(admin: AdminUser, action: string, client: ClientInfo) {
    return this.audit.record({
      adminId: admin.id,
      action,
      targetType: 'AdminUser',
      targetId: admin.id,
      targetLabel: admin.email,
      changes: client.userAgent ? { userAgent: client.userAgent.slice(0, 200) } : undefined,
      ip: client.ip ?? null,
    });
  }
}
