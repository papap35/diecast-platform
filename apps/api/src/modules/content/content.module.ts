import { Module } from '@nestjs/common';
import { AdminEventsService } from './admin-events.service.js';
import { BannersService } from './banners.service.js';
import {
  AdminBannersController,
  AdminEventsController,
  BannersController,
} from './content.controller.js';

/** 內容管理：公告、首頁橫幅與後台活動管理（前台活動 API 在 EventsModule） */
@Module({
  controllers: [BannersController, AdminBannersController, AdminEventsController],
  providers: [BannersService, AdminEventsService],
})
export class ContentModule {}
