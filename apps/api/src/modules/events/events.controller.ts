import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiLocaleQuery, ReqLocale } from '../../common/i18n/locale.decorator.js';
import type { Locale } from '../../common/i18n/locale.js';
import { EventDetailDto, EventListDto, EventListQueryDto } from './dto/event.dto.js';
import { EventsService } from './events.service.js';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  /** 活動列表（尚未結束、依開始時間排序），可依期間與類型篩選 */
  @Get()
  list(@Query() query: EventListQueryDto, @ReqLocale() locale: Locale): Promise<EventListDto> {
    return this.events.list(query, locale);
  }

  @Get(':slug')
  @ApiLocaleQuery()
  get(@Param('slug') slug: string, @ReqLocale() locale: Locale): Promise<EventDetailDto> {
    return this.events.get(slug, locale);
  }
}
