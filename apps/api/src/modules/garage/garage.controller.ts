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
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiLocaleQuery, ReqLocale } from '../../common/i18n/locale.decorator.js';
import type { Locale } from '../../common/i18n/locale.js';
import type { MemberPrincipal } from '../auth/auth.types.js';
import { CurrentMember, MemberAuth } from '../auth/decorators.js';
import {
  CreateGarageItemDto,
  GarageDto,
  GarageItemDto,
  GarageSettingsDto,
  PublicGarageDto,
  UpdateGarageItemDto,
  UpdateGarageSettingsDto,
} from './dto/garage.dto.js';
import { GarageService } from './garage.service.js';

@ApiTags('Me / Garage')
@MemberAuth()
@Controller('me/garage')
export class GarageController {
  constructor(private readonly garage: GarageService) {}

  /** 我的車庫：收藏清單、統計與公開設定 */
  @Get()
  @ApiLocaleQuery()
  get(@CurrentMember() member: MemberPrincipal, @ReqLocale() locale: Locale): Promise<GarageDto> {
    return this.garage.get(member.id, locale);
  }

  /** 登錄一台收藏（本站商品或其他來源） */
  @Post()
  @ApiLocaleQuery()
  create(
    @CurrentMember() member: MemberPrincipal,
    @Body() dto: CreateGarageItemDto,
    @ReqLocale() locale: Locale,
  ): Promise<GarageItemDto> {
    return this.garage.create(member.id, dto, locale);
  }

  /** 公開設定：開啟後任何人都能以 /garage/{handle} 瀏覽（不含購入價與備註） */
  @Put('settings')
  updateSettings(
    @CurrentMember() member: MemberPrincipal,
    @Body() dto: UpdateGarageSettingsDto,
  ): Promise<GarageSettingsDto> {
    return this.garage.updateSettings(member.id, dto);
  }

  @Patch(':id')
  @ApiLocaleQuery()
  update(
    @CurrentMember() member: MemberPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGarageItemDto,
    @ReqLocale() locale: Locale,
  ): Promise<GarageItemDto> {
    return this.garage.update(member.id, id, dto, locale);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentMember() member: MemberPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.garage.remove(member.id, id);
  }
}

@ApiTags('Garages')
@Controller('garages')
export class PublicGarageController {
  constructor(private readonly garage: GarageService) {}

  /** 公開車庫 */
  @Get(':handle')
  @ApiLocaleQuery()
  get(@Param('handle') handle: string, @ReqLocale() locale: Locale): Promise<PublicGarageDto> {
    return this.garage.getPublic(handle, locale);
  }
}
