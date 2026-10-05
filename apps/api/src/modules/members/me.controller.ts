import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { MemberPrincipal } from '../auth/auth.types.js';
import { CurrentMember, MemberAuth } from '../auth/decorators.js';
import { MemberProfileDto } from '../auth/dto/member-auth.dto.js';
import { ChangePasswordDto, DeleteAccountDto, UpdateProfileDto } from './dto/me.dto.js';
import { MeService } from './me.service.js';

@ApiTags('Me')
@MemberAuth()
@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  /** 目前登入的會員資料 */
  @Get()
  profile(@CurrentMember() member: MemberPrincipal): Promise<MemberProfileDto> {
    return this.me.profile(member.id);
  }

  @Patch()
  update(
    @CurrentMember() member: MemberPrincipal,
    @Body() dto: UpdateProfileDto,
  ): Promise<MemberProfileDto> {
    return this.me.update(member.id, dto);
  }

  /** 變更密碼（成功後所有裝置需重新登入） */
  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @CurrentMember() member: MemberPrincipal,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.me.changePassword(member.id, dto);
  }

  /** 刪除帳號（個資去識別化，訂單紀錄保留） */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAccount(
    @CurrentMember() member: MemberPrincipal,
    @Body() dto: DeleteAccountDto,
  ): Promise<void> {
    return this.me.deleteAccount(member.id, dto.password);
  }
}
