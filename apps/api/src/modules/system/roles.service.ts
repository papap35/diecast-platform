import { Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import type { Role } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { ALL_PERMISSIONS, Permission, WILDCARD } from '../auth/permissions.js';
import type { CreateRoleDto, RoleDto, RoleListDto, UpdateRoleDto } from './dto/system.dto.js';

function toRoleDto(role: Role & { _count: { admins: number } }): RoleDto {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    permissions: role.permissions,
    isSystem: role.isSystem,
    isLocked: role.permissions.includes(WILDCARD),
    adminCount: role._count.admins,
    updatedAt: role.updatedAt,
  };
}

/** 權限依清單順序排列，畫面與紀錄比較好讀 */
const sortPermissions = (permissions: string[]) =>
  ALL_PERMISSIONS.filter((permission) => permissions.includes(permission));

const withCount = { _count: { select: { admins: true } } } as const;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<RoleListDto> {
    const roles = await this.prisma.role.findMany({
      include: withCount,
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
    });
    return { data: roles.map(toRoleDto), permissions: [...ALL_PERMISSIONS] };
  }

  async create(dto: CreateRoleDto): Promise<RoleDto> {
    if (await this.prisma.role.findUnique({ where: { key: dto.key } })) {
      throw AppException.conflict(ErrorCode.ROLE_KEY_TAKEN, '角色代碼已被使用');
    }
    const role = await this.prisma.role.create({
      data: {
        key: dto.key,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        permissions: sortPermissions(dto.permissions),
      },
      include: withCount,
    });
    return toRoleDto(role);
  }

  /**
   * 修改角色名稱與權限，立即生效（後台每次請求都重新讀取權限）。
   * 超級管理員角色不可修改；不能拿掉自己角色的「管理員與權限」權限。
   */
  async update(id: string, dto: UpdateRoleDto, actorRoleKey: string): Promise<RoleDto> {
    const role = await this.findOrThrow(id);
    if (role.permissions.includes(WILDCARD)) {
      throw AppException.conflict(ErrorCode.ROLE_LOCKED, '超級管理員擁有全部權限，不可修改');
    }
    if (
      role.key === actorRoleKey &&
      dto.permissions &&
      !dto.permissions.includes(Permission.AdminManage)
    ) {
      throw AppException.conflict(
        ErrorCode.CANNOT_MODIFY_SELF,
        '不能移除自己角色的「管理員與權限」權限',
      );
    }
    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description === undefined ? undefined : dto.description?.trim() || null,
        permissions: dto.permissions ? sortPermissions(dto.permissions) : undefined,
      },
      include: withCount,
    });
    return toRoleDto(updated);
  }

  /** 只能刪除自訂、而且沒有管理員使用的角色 */
  async remove(id: string): Promise<void> {
    const role = await this.findOrThrow(id);
    if (role.isSystem || role._count.admins > 0) {
      throw AppException.conflict(
        ErrorCode.ROLE_IN_USE,
        role.isSystem ? '系統內建角色不可刪除' : '還有管理員使用這個角色',
      );
    }
    await this.prisma.role.delete({ where: { id } });
  }

  private async findOrThrow(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id }, include: withCount });
    if (!role) throw AppException.notFound(ErrorCode.NOT_FOUND, '找不到這個角色');
    return role;
  }
}
