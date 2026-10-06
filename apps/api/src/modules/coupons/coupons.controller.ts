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
import type { MemberPrincipal } from '../auth/auth.types.js';
import { AdminAuth, CurrentMember, MemberAuth } from '../auth/decorators.js';
import { Permission } from '../auth/permissions.js';
import { Audit } from '../system/audit.js';
import { AdminCouponsService } from './admin-coupons.service.js';
import { CouponsService } from './coupons.service.js';
import {
  AdminCouponDetailDto,
  AdminCouponListDto,
  AdminCouponQueryDto,
  CouponPreviewDto,
  CouponPreviewRequestDto,
  CreateCouponDto,
  UpdateCouponDto,
} from './dto/coupon.dto.js';

@ApiTags('Coupons')
@MemberAuth()
@Controller('coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  /** 結帳前試算優惠碼：回傳折扣、運費與應付金額；不符合時回傳對應的錯誤代碼 */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  preview(
    @CurrentMember() member: MemberPrincipal,
    @Body() dto: CouponPreviewRequestDto,
  ): Promise<CouponPreviewDto> {
    return this.coupons.preview(member.id, dto);
  }
}

@ApiTags('Admin / Marketing')
@AdminAuth(Permission.MarketingWrite)
@Controller('admin/coupons')
export class AdminCouponsController {
  constructor(private readonly coupons: AdminCouponsService) {}

  @Get()
  list(@Query() query: AdminCouponQueryDto): Promise<AdminCouponListDto> {
    return this.coupons.list(query);
  }

  /** 優惠券與最近 50 筆使用紀錄 */
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminCouponDetailDto> {
    return this.coupons.get(id);
  }

  @Post()
  @Audit('coupon.create', 'Coupon')
  create(@Body() dto: CreateCouponDto): Promise<AdminCouponDetailDto> {
    return this.coupons.create(dto);
  }

  @Patch(':id')
  @Audit('coupon.update', 'Coupon')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCouponDto,
  ): Promise<AdminCouponDetailDto> {
    return this.coupons.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('coupon.delete', 'Coupon')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.coupons.remove(id);
  }
}
