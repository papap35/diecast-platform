import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { DEFAULT_LOCALE } from '../../common/i18n/locale.js';
import { hashPassword, verifyPassword } from '../../common/security/password.js';
import type { Member } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type {
  LoginDto,
  MemberAuthResultDto,
  MemberProfileDto,
  RegisterDto,
} from './dto/member-auth.dto.js';
import type { TokenPairDto } from './dto/token.dto.js';
import { type ClientInfo, TokenService } from './token.service.js';

// 帳號不存在時也做一次雜湊比對，讓回應時間一致，避免被用來探測 email 是否註冊
const DUMMY_HASH = hashPassword('timing-safe-dummy-password');

export function toMemberProfile(member: Member): MemberProfileDto {
  return {
    id: member.id,
    email: member.email,
    name: member.name,
    phone: member.phone,
    locale: member.locale,
    marketingOptIn: member.marketingOptIn,
    createdAt: member.createdAt,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class MemberAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto, client: ClientInfo): Promise<MemberAuthResultDto> {
    const email = normalizeEmail(dto.email);
    const existing = await this.prisma.member.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw AppException.conflict(ErrorCode.EMAIL_TAKEN, '這個 Email 已經註冊過了');
    }

    const member = await this.prisma.member.create({
      data: {
        email,
        passwordHash: await hashPassword(dto.password),
        name: dto.name.trim(),
        locale: dto.locale ?? DEFAULT_LOCALE,
        marketingOptIn: dto.marketingOptIn ?? false,
        lastLoginAt: new Date(),
      },
    });

    return {
      member: toMemberProfile(member),
      tokens: await this.tokens.issue('MEMBER', member.id, client),
    };
  }

  async login(dto: LoginDto, client: ClientInfo): Promise<MemberAuthResultDto> {
    const member = await this.prisma.member.findUnique({
      where: { email: normalizeEmail(dto.email) },
    });
    const valid = await verifyPassword(dto.password, member?.passwordHash ?? (await DUMMY_HASH));
    if (!member || !valid) {
      throw new AppException(
        ErrorCode.INVALID_CREDENTIALS,
        'Email 或密碼錯誤',
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (member.status !== 'ACTIVE') {
      throw new AppException(
        ErrorCode.ACCOUNT_DISABLED,
        '帳號已停用，請聯繫客服',
        HttpStatus.FORBIDDEN,
      );
    }

    const updated = await this.prisma.member.update({
      where: { id: member.id },
      data: { lastLoginAt: new Date() },
    });
    return {
      member: toMemberProfile(updated),
      tokens: await this.tokens.issue('MEMBER', member.id, client),
    };
  }

  async refresh(refreshToken: string, client: ClientInfo): Promise<TokenPairDto> {
    const memberId = await this.tokens.findSubjectId('MEMBER', refreshToken);
    if (memberId) {
      const member = await this.prisma.member.findUnique({
        where: { id: memberId },
        select: { status: true },
      });
      if (!member || member.status !== 'ACTIVE') {
        await this.tokens.revokeAll('MEMBER', memberId);
        throw new AppException(
          ErrorCode.ACCOUNT_DISABLED,
          '帳號已停用，請聯繫客服',
          HttpStatus.FORBIDDEN,
        );
      }
    }
    return this.tokens.rotate('MEMBER', refreshToken, client);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }
}
