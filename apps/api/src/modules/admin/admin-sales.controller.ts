import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminPrincipal } from '../auth/auth.types.js';
import { AdminAuth, CurrentAdmin, RequirePermissions } from '../auth/decorators.js';
import { Permission } from '../auth/permissions.js';
import { InvoicesService } from '../invoices/invoices.service.js';
import { SimulateShipmentDto } from '../logistics/dto/logistics.dto.js';
import { LogisticsService } from '../logistics/logistics.service.js';
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
  constructor(
    private readonly sales: AdminSalesService,
    private readonly logistics: LogisticsService,
    private readonly invoices: InvoicesService,
  ) {}

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

  /** 建立物流單（綠界 C2C 店到店／黑貓宅配；模擬物流產生假單號）。已付款的訂單會轉為處理中 */
  @Post(':id/shipment')
  @RequirePermissions(Permission.OrderWrite)
  async createShipment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<AdminOrderDto> {
    await this.logistics.createShipment(id, admin.id);
    return this.sales.getOrder(id);
  }

  /** 推進模擬物流的配送狀態（示範用），訂單狀態會跟著更新 */
  @Post(':id/shipment/simulate')
  @RequirePermissions(Permission.OrderWrite)
  async simulateShipment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SimulateShipmentDto,
  ): Promise<AdminOrderDto> {
    await this.logistics.simulate(id, dto.status);
    return this.sales.getOrder(id);
  }

  /** 立即重試開立或作廢電子發票（重設自動重試次數） */
  @Post(':id/invoice/retry')
  @RequirePermissions(Permission.OrderWrite)
  async retryInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<AdminOrderDto> {
    await this.invoices.retry(id, admin.id);
    return this.sales.getOrder(id);
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
