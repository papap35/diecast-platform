import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiLocaleQuery, ReqLocale } from '../../common/i18n/locale.decorator.js';
import type { Locale } from '../../common/i18n/locale.js';
import type { MemberPrincipal } from '../auth/auth.types.js';
import { CurrentMember, MemberAuth } from '../auth/decorators.js';
import { CartService } from './cart.service.js';
import { CartDto, QuoteDto, SetCartItemDto } from './dto/cart.dto.js';

@ApiTags('Cart')
@MemberAuth()
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  /** 購物車內容、小計、各配送方式運費，以及需要處理的問題（售完、超過限購等） */
  @Get()
  @ApiLocaleQuery()
  get(@CurrentMember() member: MemberPrincipal, @ReqLocale() locale: Locale): Promise<CartDto> {
    return this.cart.getCart(member.id, locale);
  }

  /** 加入或更新商品數量 */
  @Put('items/:productId')
  @ApiLocaleQuery()
  setItem(
    @CurrentMember() member: MemberPrincipal,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: SetCartItemDto,
    @ReqLocale() locale: Locale,
  ): Promise<CartDto> {
    return this.cart.setItem(member.id, productId, dto.quantity, locale);
  }

  @Delete('items/:productId')
  @ApiLocaleQuery()
  removeItem(
    @CurrentMember() member: MemberPrincipal,
    @Param('productId', ParseUUIDPipe) productId: string,
    @ReqLocale() locale: Locale,
  ): Promise<CartDto> {
    return this.cart.removeItem(member.id, productId, locale);
  }

  /** 結帳試算（立即購買用）：不影響購物車內容 */
  @Post('quote')
  @HttpCode(HttpStatus.OK)
  @ApiLocaleQuery()
  quote(
    @CurrentMember() member: MemberPrincipal,
    @Body() dto: QuoteDto,
    @ReqLocale() locale: Locale,
  ): Promise<CartDto> {
    return this.cart.quote(member.id, dto.items, locale);
  }

  /** 清空購物車 */
  @Delete()
  @ApiLocaleQuery()
  clear(@CurrentMember() member: MemberPrincipal, @ReqLocale() locale: Locale): Promise<CartDto> {
    return this.cart.clear(member.id, locale);
  }
}
