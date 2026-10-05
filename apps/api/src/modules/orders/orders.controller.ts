import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReqLocale } from '../../common/i18n/locale.decorator.js';
import type { Locale } from '../../common/i18n/locale.js';
import type { MemberPrincipal } from '../auth/auth.types.js';
import { CurrentMember, MemberAuth } from '../auth/decorators.js';
import { CheckoutDto, OrderDto, OrderListDto, OrderListQueryDto } from './dto/order.dto.js';
import { OrdersService } from './orders.service.js';

@ApiTags('Orders')
@MemberAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /**
   * 結帳建立訂單。成功後庫存即保留給此訂單，需在 paymentDeadline 前付款，
   * 接著呼叫 `POST /v1/orders/{orderNo}/payments` 取得付款資訊。
   */
  @Post()
  checkout(
    @CurrentMember() member: MemberPrincipal,
    @Body() dto: CheckoutDto,
    @ReqLocale() locale: Locale,
  ): Promise<OrderDto> {
    return this.orders.checkout(member.id, dto, locale);
  }

  /** 我的訂單 */
  @Get()
  list(
    @CurrentMember() member: MemberPrincipal,
    @Query() query: OrderListQueryDto,
  ): Promise<OrderListDto> {
    return this.orders.listForMember(member.id, query);
  }

  @Get(':orderNo')
  get(
    @CurrentMember() member: MemberPrincipal,
    @Param('orderNo') orderNo: string,
  ): Promise<OrderDto> {
    return this.orders.getForMember(member.id, orderNo);
  }

  /** 取消未付款訂單（庫存會立即釋放） */
  @Post(':orderNo/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentMember() member: MemberPrincipal,
    @Param('orderNo') orderNo: string,
  ): Promise<OrderDto> {
    return this.orders.cancelByMember(member.id, orderNo);
  }
}
