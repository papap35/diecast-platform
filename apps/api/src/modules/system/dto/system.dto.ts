import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PageMeta, PaginationQuery } from '../../../common/http/pagination.dto.js';
import { ALL_PERMISSIONS } from '../../auth/permissions.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class AdminRoleSummaryDto {
  id!: string;
  key!: string;
  name!: string;
}

export class AdminUserDto {
  id!: string;
  email!: string;
  name!: string;
  isActive!: boolean;
  lastLoginAt!: Date | null;
  createdAt!: Date;
  role!: AdminRoleSummaryDto;
}

export class AdminUserListDto {
  data!: AdminUserDto[];
}

export class CreateAdminUserDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @IsUUID()
  roleId!: string;

  /** 初始密碼（至少 10 個字元）；請另外告知對方，登入後自行修改 */
  @IsString()
  @MinLength(10)
  @MaxLength(72)
  password!: string;
}

export class UpdateAdminUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsUUID()
  roleId?: string;

  /** 停用後立即登出所有裝置 */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ResetAdminPasswordDto {
  /** 新密碼（至少 10 個字元）；重設後該管理員所有裝置都會被登出 */
  @IsString()
  @MinLength(10)
  @MaxLength(72)
  password!: string;
}

export class ChangeAdminPasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  /** 至少 10 個字元 */
  @IsString()
  @MinLength(10)
  @MaxLength(72)
  newPassword!: string;
}

export class RoleDto {
  id!: string;
  key!: string;
  name!: string;
  description!: string | null;
  permissions!: string[];
  /** 系統內建角色不可刪除 */
  isSystem!: boolean;
  /** 擁有全部權限（超級管理員），不可修改 */
  isLocked!: boolean;
  adminCount!: number;
  updatedAt!: Date;
}

export class RoleListDto {
  data!: RoleDto[];
  /** 可以指派給角色的權限 */
  permissions!: string[];
}

export class CreateRoleDto {
  /** 角色代碼：小寫英文開頭，可含數字與底線，3～30 字元 */
  @Matches(/^[a-z][a-z0-9_]{2,29}$/, { message: '角色代碼需為 3～30 個小寫英數或底線' })
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string | null;

  @ApiProperty({ type: [String], enum: ALL_PERMISSIONS })
  @IsArray()
  @ArrayUnique()
  @IsIn(ALL_PERMISSIONS, { each: true })
  permissions!: string[];
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string | null;

  @ApiPropertyOptional({ type: [String], enum: ALL_PERMISSIONS })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(ALL_PERMISSIONS, { each: true })
  permissions?: string[];
}

export class AuditAdminDto {
  id!: string;
  name!: string;
  email!: string;
}

export class AuditLogDto {
  id!: string;
  /** 動作代碼，例如 product.update */
  action!: string;
  targetType!: string;
  targetId!: string | null;
  /** 寫入當下的辨識文字（訂單編號、Email、SKU…） */
  targetLabel!: string | null;
  /** 送出的內容（已遮蔽密碼等敏感欄位） */
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  changes!: Record<string, unknown> | null;
  ip!: string | null;
  createdAt!: Date;
  /** 管理員帳號刪除後為 null */
  admin!: AuditAdminDto | null;
}

export class AuditLogQueryDto extends PaginationQuery {
  @IsOptional()
  @IsUUID()
  adminId?: string;

  /** 動作代碼或前綴，例如 order 或 order.status */
  @IsOptional()
  @Matches(/^[a-z_]+(\.[a-z_]+)?$/)
  action?: string;

  @IsOptional()
  @Matches(/^[A-Za-z]{2,30}$/)
  targetType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  targetId?: string;

  /** 起日（含，台北時間 YYYY-MM-DD） */
  @IsOptional()
  @Matches(DAY)
  from?: string;

  /** 迄日（含，台北時間 YYYY-MM-DD） */
  @IsOptional()
  @Matches(DAY)
  to?: string;
}

export class AuditLogListDto {
  data!: AuditLogDto[];
  meta!: PageMeta;
}
