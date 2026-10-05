import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQuery } from '../../common/http/pagination.dto.js';
import type { MemberPrincipal } from '../auth/auth.types.js';
import { CurrentMember, MemberAuth } from '../auth/decorators.js';
import {
  MarkReadDto,
  MarkReadResultDto,
  NotificationListDto,
  UnreadCountDto,
} from './dto/notification.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Me / Notifications')
@MemberAuth()
@Controller('me/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** 站內通知（新到舊），附未讀數 */
  @Get()
  list(
    @CurrentMember() member: MemberPrincipal,
    @Query() query: PaginationQuery,
  ): Promise<NotificationListDto> {
    return this.notifications.list(member.id, query);
  }

  /** 未讀數（頁首鈴鐺用） */
  @Get('unread-count')
  async unreadCount(@CurrentMember() member: MemberPrincipal): Promise<UnreadCountDto> {
    return { count: await this.notifications.unreadCount(member.id) };
  }

  /** 標示為已讀；不帶 ids 表示全部 */
  @Post('read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @CurrentMember() member: MemberPrincipal,
    @Body() dto: MarkReadDto,
  ): Promise<MarkReadResultDto> {
    return { updated: await this.notifications.markRead(member.id, dto.ids) };
  }
}
