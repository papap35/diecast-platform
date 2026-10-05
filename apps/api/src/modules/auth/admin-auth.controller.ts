import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AdminPrincipal } from './auth.types.js';
import { AdminAuthService } from './admin-auth.service.js';
import { Client } from './client-info.js';
import { AdminAuth, CurrentAdmin } from './decorators.js';
import { AdminAuthResultDto, AdminLoginDto, AdminProfileDto } from './dto/admin-auth.dto.js';
import { RefreshTokenDto, TokenPairDto } from './dto/token.dto.js';
import type { ClientInfo } from './token.service.js';

@ApiTags('Admin / Auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  /** 後台登入 */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: AdminLoginDto, @Client() client: ClientInfo): Promise<AdminAuthResultDto> {
    return this.auth.login(dto, client);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto, @Client() client: ClientInfo): Promise<TokenPairDto> {
    return this.auth.refresh(dto.refreshToken, client);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() dto: RefreshTokenDto): Promise<void> {
    return this.auth.logout(dto.refreshToken);
  }

  /** 目前登入的管理員與其權限 */
  @Get('me')
  @AdminAuth()
  me(@CurrentAdmin() admin: AdminPrincipal): Promise<AdminProfileDto> {
    return this.auth.me(admin.id);
  }
}
