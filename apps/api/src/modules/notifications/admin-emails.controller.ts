import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminAuth } from '../auth/decorators.js';
import { Permission } from '../auth/permissions.js';
import { Audit } from '../system/audit.js';
import { AdminEmailsService } from './admin-emails.service.js';
import {
  AdminEmailDto,
  AdminEmailListDto,
  AdminEmailQueryDto,
  RetryEmailsResultDto,
} from './dto/admin-email.dto.js';

@ApiTags('Admin / Emails')
@AdminAuth(Permission.AdminManage)
@Controller('admin/emails')
export class AdminEmailsController {
  constructor(private readonly emails: AdminEmailsService) {}

  /** 寄信紀錄（新到舊），附各狀態封數 */
  @Get()
  list(@Query() query: AdminEmailQueryDto): Promise<AdminEmailListDto> {
    return this.emails.list(query);
  }

  /** 全部寄送失敗的信重新排入寄送 */
  @Post('retry-failed')
  @HttpCode(HttpStatus.OK)
  @Audit('email.retry_failed', 'EmailMessage')
  retryFailed(): Promise<RetryEmailsResultDto> {
    return this.emails.retryFailed();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminEmailDto> {
    return this.emails.get(id);
  }

  /** 寄送失敗的信重新排入寄送 */
  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  @Audit('email.retry', 'EmailMessage')
  retry(@Param('id', ParseUUIDPipe) id: string): Promise<AdminEmailDto> {
    return this.emails.retry(id);
  }
}
