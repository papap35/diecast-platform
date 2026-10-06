import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminAuth } from '../auth/decorators.js';
import { Permission } from '../auth/permissions.js';
import { Audit } from '../system/audit.js';
import { StoreSettingsDto, UpdateStoreSettingsDto } from './dto/settings.dto.js';
import { SettingsService } from './settings.service.js';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** 前台顯示用的運費、免運門檻與付款期限 */
  @Get()
  get(): Promise<StoreSettingsDto> {
    return this.settings.getDto();
  }
}

@ApiTags('Admin / Settings')
@AdminAuth(Permission.SettingsWrite)
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(): Promise<StoreSettingsDto> {
    return this.settings.getDto();
  }

  /** 修改運費與付款期限（購物車與結帳立即套用；已成立的訂單不受影響） */
  @Put()
  @Audit('settings.update', 'Setting')
  update(@Body() dto: UpdateStoreSettingsDto): Promise<StoreSettingsDto> {
    return this.settings.update(dto);
  }
}
