import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiLocaleQuery, ReqLocale } from '../../common/i18n/locale.decorator.js';
import type { Locale } from '../../common/i18n/locale.js';
import type { MemberPrincipal } from '../auth/auth.types.js';
import { CurrentMember, MemberAuth } from '../auth/decorators.js';
import { ProductIdListDto, WishlistDto } from './dto/wishlist.dto.js';
import { WishlistService } from './wishlist.service.js';

@ApiTags('Me / Wishlist')
@MemberAuth()
@Controller('me/wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  /** 願望清單（新到舊）；售完的商品補貨時會通知 */
  @Get()
  @ApiLocaleQuery()
  list(
    @CurrentMember() member: MemberPrincipal,
    @ReqLocale() locale: Locale,
  ): Promise<WishlistDto> {
    return this.wishlist.list(member.id, locale);
  }

  /** 已加入的商品 id */
  @Get('ids')
  async ids(@CurrentMember() member: MemberPrincipal): Promise<ProductIdListDto> {
    return { ids: await this.wishlist.ids(member.id) };
  }

  /** 加入願望清單（重複加入不會出錯） */
  @Put(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  add(
    @CurrentMember() member: MemberPrincipal,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<void> {
    return this.wishlist.add(member.id, productId);
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentMember() member: MemberPrincipal,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<void> {
    return this.wishlist.remove(member.id, productId);
  }
}
