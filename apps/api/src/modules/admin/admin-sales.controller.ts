import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminPrincipal } from '../auth/auth.types.js';
import { AdminAuth, CurrentAdmin, RequirePermissions } from '../auth/decorators.js';
import { Permission } from '../auth/permissions.js';
import { AdminSalesService } from './admin-sales.service.js';
import {
  AdminMemberDto,
  AdminMemberListDto,
  AdminMemberQueryDto,
  UpdateMemberStatusDto,
} from './dto/admin-members.dto.js';
import {
  AddOrderNoteDto,
  AdminOrderDto,
  AdminOrderListDto,
  AdminOrderQueryDto,
  UpdateOrderStatusDto,
} from './dto/admin-orders.dto.js';
import { DashboardDto } from './dto/dashboard.dto.js';

@ApiTags('Admin / Dashboard')
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly sales: AdminSalesService) {}

  /** 營運儀表板：關鍵指標、14 天營收、熱銷、低庫存、即將發售、最新訂單 */
  @Get()
  @AdminAuth(Permission.DashboardRead)
  get(): Promise<DashboardDto> {
    return this.sales.dashboard();
  }
}

@ApiTags('Admin / Orders')
@AdminAuth(Permission.OrderRead)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly sales: AdminSalesService) {}

  @Get()
  list(@Query() query: AdminOrderQueryDto): Promise<AdminOrderListDto> {
    return this.sales.listOrders(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminOrderDto> {
    return this.sales.getOrder(id);
  }

  /** 變更訂單狀態（依狀態機檢查；取消與退款會自動釋放庫存） */
  @Post(':id/status')
  @RequirePermissions(Permission.OrderWrite)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<AdminOrderDto> {
    return this.sales.updateOrderStatus(id, dto.status, admin.id, dto.note);
  }

  /** 新增內部備註 */
  @Post(':id/notes')
  @RequirePermissions(Permission.OrderWrite)
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddOrderNoteDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<AdminOrderDto> {
    return this.sales.addOrderNote(id, dto.message, admin.id);
  }
}

@ApiTags('Admin / Members')
@AdminAuth(Permission.MemberRead)
@Controller('admin/members')
export class AdminMembersController {
  constructor(private readonly sales: AdminSalesService) {}

  @Get()
  list(@Query() query: AdminMemberQueryDto): Promise<AdminMemberListDto> {
    return this.sales.listMembers(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminMemberDto> {
    return this.sales.getMember(id);
  }

  /** 停權或恢復會員 */
  @Patch(':id/status')
  @RequirePermissions(Permission.MemberWrite)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMemberStatusDto,
  ): Promise<AdminMemberDto> {
    return this.sales.updateMemberStatus(id, dto.status);
  }
}
