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
import type { AdminPrincipal } from '../auth/auth.types.js';
import { AdminAuth, CurrentAdmin } from '../auth/decorators.js';
import { Permission } from '../auth/permissions.js';
import { Audit } from '../system/audit.js';
import { CampaignsService } from './campaigns.service.js';
import {
  CampaignDto,
  CampaignListDto,
  CampaignQueryDto,
  CreateCampaignDto,
  ScheduleCampaignDto,
  TestCampaignDto,
  UnsubscribeDto,
  UpdateCampaignDto,
} from './dto/campaign.dto.js';

@ApiTags('Marketing')
@Controller('unsubscribe')
export class UnsubscribeController {
  constructor(private readonly campaigns: CampaignsService) {}

  /** 退訂電子報（前台確認頁送出；不需要登入，靠連結中的簽章權杖辨識會員） */
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  unsubscribe(@Body() dto: UnsubscribeDto): Promise<void> {
    return this.campaigns.unsubscribe(dto.token);
  }

  /** RFC 8058 一鍵退訂：信箱服務（Gmail、Yahoo…）依 List-Unsubscribe 標頭直接 POST */
  @Post('one-click')
  @HttpCode(HttpStatus.OK)
  async oneClick(@Query('token') token: string): Promise<{ ok: true }> {
    await this.campaigns.unsubscribe(token ?? '');
    return { ok: true };
  }
}

@ApiTags('Admin / Marketing')
@AdminAuth(Permission.MarketingWrite)
@Controller('admin/campaigns')
export class AdminCampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  list(@Query() query: CampaignQueryDto): Promise<CampaignListDto> {
    return this.campaigns.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<CampaignDto> {
    return this.campaigns.get(id);
  }

  @Post()
  @Audit('campaign.create', 'Campaign')
  create(@Body() dto: CreateCampaignDto): Promise<CampaignDto> {
    return this.campaigns.create(dto);
  }

  /** 只有草稿可以修改 */
  @Patch(':id')
  @Audit('campaign.update', 'Campaign')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignDto,
  ): Promise<CampaignDto> {
    return this.campaigns.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('campaign.delete', 'Campaign')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.campaigns.remove(id);
  }

  /** 寄一封測試信給自己（或指定 Email） */
  @Post(':id/test')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('campaign.test', 'Campaign')
  test(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TestCampaignDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<void> {
    return this.campaigns.sendTest(id, dto, admin);
  }

  /** 排程寄送；不指定時間表示立即（排程每分鐘檢查） */
  @Post(':id/schedule')
  @HttpCode(HttpStatus.OK)
  @Audit('campaign.schedule', 'Campaign')
  schedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ScheduleCampaignDto,
  ): Promise<CampaignDto> {
    return this.campaigns.schedule(id, dto);
  }

  /** 取消排程，回到草稿 */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Audit('campaign.cancel', 'Campaign')
  cancel(@Param('id', ParseUUIDPipe) id: string): Promise<CampaignDto> {
    return this.campaigns.cancel(id);
  }
}
