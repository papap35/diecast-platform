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
import { ProductIdListDto } from '../wishlist/dto/wishlist.dto.js';
import { ReminderListDto } from './dto/reminder.dto.js';
import { RemindersService } from './reminders.service.js';

@ApiTags('Me / Reminders')
@MemberAuth()
@Controller('me/reminders')
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  /** 尚未開賣的發售提醒（依通知時間排序） */
  @Get()
  @ApiLocaleQuery()
  list(
    @CurrentMember() member: MemberPrincipal,
    @ReqLocale() locale: Locale,
  ): Promise<ReminderListDto> {
    return this.reminders.list(member.id, locale);
  }

  /** 已設定提醒的商品 id */
  @Get('ids')
  async ids(@CurrentMember() member: MemberPrincipal): Promise<ProductIdListDto> {
    return { ids: await this.reminders.ids(member.id) };
  }

  /** 設定發售提醒：開賣（或你的優先購開始）前 15 分鐘通知 */
  @Put(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  add(
    @CurrentMember() member: MemberPrincipal,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<void> {
    return this.reminders.add(member.id, productId);
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentMember() member: MemberPrincipal,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<void> {
    return this.reminders.remove(member.id, productId);
  }
}
