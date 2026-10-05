import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Client } from './client-info.js';
import { LoginDto, MemberAuthResultDto, RegisterDto } from './dto/member-auth.dto.js';
import { RefreshTokenDto, TokenPairDto } from './dto/token.dto.js';
import { MemberAuthService } from './member-auth.service.js';
import type { ClientInfo } from './token.service.js';

@ApiTags('Auth')
@Controller('auth')
export class MemberAuthController {
  constructor(private readonly auth: MemberAuthService) {}

  /** 會員註冊，成功後直接回傳登入權杖 */
  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  register(@Body() dto: RegisterDto, @Client() client: ClientInfo): Promise<MemberAuthResultDto> {
    return this.auth.register(dto, client);
  }

  /** 會員登入 */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto, @Client() client: ClientInfo): Promise<MemberAuthResultDto> {
    return this.auth.login(dto, client);
  }

  /** 以 refresh token 換發新權杖（舊的 refresh token 會失效） */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto, @Client() client: ClientInfo): Promise<TokenPairDto> {
    return this.auth.refresh(dto.refreshToken, client);
  }

  /** 登出：作廢此 refresh token 所屬的工作階段 */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() dto: RefreshTokenDto): Promise<void> {
    return this.auth.logout(dto.refreshToken);
  }
}
