import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminPrincipal } from '../auth/auth.types.js';
import { AdminAuth, CurrentAdmin } from '../auth/decorators.js';
import { Permission } from '../auth/permissions.js';
import { AdminUsersService } from './admin-users.service.js';
import { Audit } from './audit.js';
import { AuditService } from './audit.service.js';
import {
  AdminUserDto,
  AdminUserListDto,
  AuditLogListDto,
  AuditLogQueryDto,
  CreateAdminUserDto,
  CreateRoleDto,
  ResetAdminPasswordDto,
  RoleDto,
  RoleListDto,
  UpdateAdminUserDto,
  UpdateRoleDto,
} from './dto/system.dto.js';
import { RolesService } from './roles.service.js';

@ApiTags('Admin / System')
@AdminAuth(Permission.AdminManage)
@Controller('admin/admins')
export class AdminUsersController {
  constructor(private readonly admins: AdminUsersService) {}

  @Get()
  list(): Promise<AdminUserListDto> {
    return this.admins.list();
  }

  /** 新增管理員（初始密碼由建立者設定，請另外告知對方） */
  @Post()
  @Audit('admin.create', 'AdminUser')
  create(@Body() dto: CreateAdminUserDto): Promise<AdminUserDto> {
    return this.admins.create(dto);
  }

  /** 修改名稱、角色或啟用狀態；停用後立即登出該管理員所有裝置 */
  @Patch(':id')
  @Audit('admin.update', 'AdminUser')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminUserDto,
    @CurrentAdmin() actor: AdminPrincipal,
  ): Promise<AdminUserDto> {
    return this.admins.update(id, dto, actor.id);
  }

  /** 重設密碼並登出該管理員所有裝置 */
  @Post(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('admin.reset_password', 'AdminUser')
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetAdminPasswordDto,
    @CurrentAdmin() actor: AdminPrincipal,
  ): Promise<void> {
    return this.admins.resetPassword(id, dto.password, actor.id);
  }
}

@ApiTags('Admin / System')
@AdminAuth(Permission.AdminManage)
@Controller('admin/roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  /** 角色清單與可指派的權限 */
  @Get()
  list(): Promise<RoleListDto> {
    return this.roles.list();
  }

  @Post()
  @Audit('role.create', 'Role')
  create(@Body() dto: CreateRoleDto): Promise<RoleDto> {
    return this.roles.create(dto);
  }

  /** 修改角色，立即對所有使用這個角色的管理員生效 */
  @Patch(':id')
  @Audit('role.update', 'Role')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentAdmin() actor: AdminPrincipal,
  ): Promise<RoleDto> {
    return this.roles.update(id, dto, actor.roleKey);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('role.delete', 'Role')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.roles.remove(id);
  }
}

@ApiTags('Admin / System')
@AdminAuth(Permission.AdminManage)
@Controller('admin/audit-logs')
export class AuditLogsController {
  constructor(private readonly audit: AuditService) {}

  /** 操作紀錄：可依管理員、動作、資料與日期篩選 */
  @Get()
  list(@Query() query: AuditLogQueryDto): Promise<AuditLogListDto> {
    return this.audit.list(query);
  }
}
