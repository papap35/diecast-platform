import { Readable } from 'node:stream';
import { Controller, Get, Query, Req, StreamableFile } from '@nestjs/common';
import { ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AdminPrincipal } from '../auth/auth.types.js';
import { AdminAuth, CurrentAdmin, RequirePermissions } from '../auth/decorators.js';
import { Permission } from '../auth/permissions.js';
import { AuditService } from '../system/audit.service.js';
import {
  OrdersExportQueryDto,
  ReportRangeQueryDto,
  SalesReportDto,
  SalesReportQueryDto,
} from './dto/report.dto.js';
import { ReportsService } from './reports.service.js';

@ApiTags('Admin / Reports')
@AdminAuth(Permission.ReportRead)
@Controller('admin/reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly audit: AuditService,
  ) {}

  /** 銷售報表：營收趨勢與前期比較、品牌／分類／銷售型態／配送／會員等級分析、熱銷商品、優惠券成效 */
  @Get('sales')
  sales(@Query() query: SalesReportQueryDto): Promise<SalesReportDto> {
    return this.reports.salesReport(query);
  }

  /** 商品銷售 CSV（依付款日，扣除已退款訂單） */
  @Get('products.csv')
  @ApiProduces('text/csv')
  @ApiOkResponse({ schema: { type: 'string' } })
  async productsCsv(
    @Query() query: ReportRangeQueryDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() req: Request,
  ): Promise<StreamableFile> {
    const { filename, content } = await this.reports.productsCsv(query);
    await this.recordExport('report.export_products', filename, query, admin, req);
    return csvFile(Readable.from([content]), filename);
  }

  /** 訂單明細 CSV（依下單日）。內容有會員與收件人資料，另外需要訂單檢視權限，匯出會記到操作紀錄 */
  @Get('orders.csv')
  @RequirePermissions(Permission.ReportRead, Permission.OrderRead)
  @ApiProduces('text/csv')
  @ApiOkResponse({ schema: { type: 'string' } })
  async ordersCsv(
    @Query() query: OrdersExportQueryDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() req: Request,
  ): Promise<StreamableFile> {
    const { period, filename } = this.reports.ordersExport(query);
    await this.recordExport('report.export_orders', filename, query, admin, req);
    return csvFile(Readable.from(this.reports.ordersCsv(period, query.status)), filename);
  }

  private recordExport(
    action: string,
    filename: string,
    query: object,
    admin: AdminPrincipal,
    req: Request,
  ): Promise<void> {
    return this.audit.record({
      adminId: admin.id,
      action,
      targetType: 'Report',
      targetLabel: filename,
      changes: { ...query },
      ip: req.ip ?? null,
    });
  }
}

function csvFile(stream: Readable, filename: string): StreamableFile {
  return new StreamableFile(stream, {
    type: 'text/csv; charset=utf-8',
    disposition: `attachment; filename="${filename}"`,
  });
}
