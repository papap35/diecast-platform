import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AdminUsersService } from './admin-users.service.js';
import { AuditInterceptor } from './audit.interceptor.js';
import { AuditService } from './audit.service.js';
import { RolesService } from './roles.service.js';
import { AdminUsersController, AuditLogsController, RolesController } from './system.controller.js';

/** 後台系統管理：管理員帳號、角色權限與操作紀錄（AuditService 全域可用） */
@Global()
@Module({
  controllers: [AdminUsersController, RolesController, AuditLogsController],
  providers: [
    AuditService,
    AdminUsersService,
    RolesService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class SystemModule {}
