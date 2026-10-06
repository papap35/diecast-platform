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
import { ReqLocale } from '../../common/i18n/locale.decorator.js';
import type { Locale } from '../../common/i18n/locale.js';
import { AdminAuth } from '../auth/decorators.js';
import { Permission } from '../auth/permissions.js';
import { Audit } from '../system/audit.js';
import { AdminEventsService } from './admin-events.service.js';
import { BannersService } from './banners.service.js';
import {
  AdminBannerDto,
  AdminBannerListDto,
  AdminBannerQueryDto,
  AdminEventDto,
  AdminEventListDto,
  AdminEventQueryDto,
  BannerDto,
  BannerQueryDto,
  CreateBannerDto,
  CreateEventDto,
  UpdateBannerDto,
  UpdateEventDto,
} from './dto/content.dto.js';

@ApiTags('Content')
@Controller('banners')
export class BannersController {
  constructor(private readonly banners: BannersService) {}

  /** 目前上架中的公告或首頁橫幅（已依語系挑好文字） */
  @Get()
  list(@Query() query: BannerQueryDto, @ReqLocale() locale: Locale): Promise<BannerDto[]> {
    return this.banners.live(query.placement, locale);
  }
}

@ApiTags('Admin / Content')
@AdminAuth(Permission.ContentWrite)
@Controller('admin/banners')
export class AdminBannersController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  list(@Query() query: AdminBannerQueryDto): Promise<AdminBannerListDto> {
    return this.banners.list(query);
  }

  @Post()
  @Audit('banner.create', 'Banner')
  create(@Body() dto: CreateBannerDto): Promise<AdminBannerDto> {
    return this.banners.create(dto);
  }

  @Patch(':id')
  @Audit('banner.update', 'Banner')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBannerDto,
  ): Promise<AdminBannerDto> {
    return this.banners.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('banner.delete', 'Banner')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.banners.remove(id);
  }
}

@ApiTags('Admin / Content')
@AdminAuth(Permission.ContentWrite)
@Controller('admin/events')
export class AdminEventsController {
  constructor(private readonly events: AdminEventsService) {}

  @Get()
  list(@Query() query: AdminEventQueryDto): Promise<AdminEventListDto> {
    return this.events.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminEventDto> {
    return this.events.get(id);
  }

  @Post()
  @Audit('event.create', 'Event')
  create(@Body() dto: CreateEventDto): Promise<AdminEventDto> {
    return this.events.create(dto);
  }

  @Patch(':id')
  @Audit('event.update', 'Event')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
  ): Promise<AdminEventDto> {
    return this.events.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('event.delete', 'Event')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.events.remove(id);
  }
}
