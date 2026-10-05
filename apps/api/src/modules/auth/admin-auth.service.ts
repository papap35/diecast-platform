import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { verifyPassword, hashPassword } from '../../common/security/password.js';
import type { AdminUser, Role } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
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
  ) {}

  async login(dto: AdminLoginDto, client: ClientInfo): Promise<AdminAuthResultDto> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email: normalizeEmail(dto.email) },
      include: { role: true },
    });
    const valid = await verifyPassword(dto.password, admin?.passwordHash ?? (await DUMMY_HASH));
    if (!admin || !valid) {
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

  async me(adminId: string): Promise<AdminProfileDto> {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({
      where: { id: adminId },
      include: { role: true },
    });
    return toAdminProfile(admin);
  }
}
