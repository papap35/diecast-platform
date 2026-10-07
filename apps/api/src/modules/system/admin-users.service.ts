import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { assertNotDemoAccount } from '../../common/demo/demo-accounts.js';
import { APP_CONFIG, type AppConfig } from '../../config/config.module.js';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { hashPassword } from '../../common/security/password.js';
import type { AdminUser, Prisma, Role } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { normalizeEmail } from '../auth/member-auth.service.js';
import { WILDCARD } from '../auth/permissions.js';
import { TokenService } from '../auth/token.service.js';
import type {
  AdminUserDto,
  AdminUserListDto,
  CreateAdminUserDto,
  UpdateAdminUserDto,
} from './dto/system.dto.js';

type AdminWithRole = AdminUser & { role: Role };

export function toAdminUserDto(admin: AdminWithRole): AdminUserDto {
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    isActive: admin.isActive,
    lastLoginAt: admin.lastLoginAt,
    createdAt: admin.createdAt,
    role: { id: admin.role.id, key: admin.role.key, name: admin.role.name },
  };
}

const isSuperRole = (role: Pick<Role, 'permissions'>) => role.permissions.includes(WILDCARD);

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async list(): Promise<AdminUserListDto> {
    const admins = await this.prisma.adminUser.findMany({
      include: { role: true },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });
    return { data: admins.map(toAdminUserDto) };
  }

  async create(dto: CreateAdminUserDto): Promise<AdminUserDto> {
    const email = normalizeEmail(dto.email);
    if (await this.prisma.adminUser.findUnique({ where: { email } })) {
      throw AppException.conflict(ErrorCode.EMAIL_TAKEN, '這個 Email 已經是管理員');
    }
    await this.findRole(dto.roleId);
    const admin = await this.prisma.adminUser.create({
      data: {
        email,
        name: dto.name.trim(),
        roleId: dto.roleId,
        passwordHash: await hashPassword(dto.password),
      },
      include: { role: true },
    });
    return toAdminUserDto(admin);
  }

  /**
   * 修改名稱、角色或啟用狀態。
   * 不能停用自己或改自己的角色；超級管理員至少要留一位啟用中，避免後台沒有人能管理權限。
   */
  async update(id: string, dto: UpdateAdminUserDto, actorId: string): Promise<AdminUserDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      // 這段檢查與更新排隊執行：兩個人同時降級最後兩位超管，不會兩邊都成功
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('admin-users'))`;
      const admin = await tx.adminUser.findUnique({ where: { id }, include: { role: true } });
      if (!admin) throw AppException.notFound(ErrorCode.NOT_FOUND, '找不到這位管理員');
      assertNotDemoAccount(this.config, admin.email);
      const roleChanged = dto.roleId !== undefined && dto.roleId !== admin.roleId;
      if (id === actorId && (roleChanged || dto.isActive === false)) {
        throw this.selfError('不能停用自己或變更自己的角色');
      }
      const role = roleChanged ? await this.findRole(dto.roleId!, tx) : admin.role;
      const isActive = dto.isActive ?? admin.isActive;
      if (admin.isActive && isSuperRole(admin.role) && !(isActive && isSuperRole(role))) {
        await this.assertAnotherSuperAdmin(tx, admin.id);
      }
      return tx.adminUser.update({
        where: { id },
        data: { name: dto.name?.trim(), roleId: role.id, isActive },
        include: { role: true },
      });
    });
    if (dto.isActive === false) await this.tokens.revokeAll('ADMIN', id);
    return toAdminUserDto(updated);
  }

  /** 重設其他管理員的密碼，並登出對方所有裝置（自己的密碼請用「修改密碼」） */
  async resetPassword(id: string, password: string, actorId: string): Promise<void> {
    if (id === actorId) throw this.selfError('請從「修改密碼」變更自己的密碼');
    const admin = await this.prisma.adminUser.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
    if (!admin) throw AppException.notFound(ErrorCode.NOT_FOUND, '找不到這位管理員');
    assertNotDemoAccount(this.config, admin.email);
    await this.prisma.adminUser.update({
      where: { id },
      data: { passwordHash: await hashPassword(password), tokensValidAfter: new Date() },
    });
    await this.tokens.revokeAll('ADMIN', id);
  }

  private async findRole(roleId: string, tx: Prisma.TransactionClient = this.prisma) {
    const role = await tx.role.findUnique({ where: { id: roleId } });
    if (!role) throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, '找不到這個角色');
    return role;
  }

  private async assertAnotherSuperAdmin(tx: Prisma.TransactionClient, exceptId: string) {
    const others = await tx.adminUser.count({
      where: { id: { not: exceptId }, isActive: true, role: { permissions: { has: WILDCARD } } },
    });
    if (others === 0) {
      throw AppException.conflict(ErrorCode.LAST_SUPER_ADMIN, '至少要保留一位啟用中的超級管理員');
    }
  }

  private selfError(message: string) {
    return new AppException(ErrorCode.CANNOT_MODIFY_SELF, message, HttpStatus.CONFLICT);
  }
}
