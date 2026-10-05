import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { generateOpaqueToken } from '../../common/security/random.js';
import { hashPassword, verifyPassword } from '../../common/security/password.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { MemberProfileDto } from '../auth/dto/member-auth.dto.js';
import { toMemberProfile } from '../auth/member-auth.service.js';
import { TokenService } from '../auth/token.service.js';
import type { ChangePasswordDto, UpdateProfileDto } from './dto/me.dto.js';

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async profile(memberId: string): Promise<MemberProfileDto> {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member || member.status !== 'ACTIVE') {
      throw AppException.unauthorized(ErrorCode.ACCOUNT_DISABLED, '帳號已停用或不存在');
    }
    return toMemberProfile(member);
  }

  async update(memberId: string, dto: UpdateProfileDto): Promise<MemberProfileDto> {
    const member = await this.prisma.member.update({
      where: { id: memberId },
      data: { ...dto, name: dto.name?.trim() },
    });
    return toMemberProfile(member);
  }

  /** 變更密碼後作廢所有既有登入，其他裝置需重新登入 */
  async changePassword(memberId: string, dto: ChangePasswordDto): Promise<void> {
    const member = await this.prisma.member.findUniqueOrThrow({ where: { id: memberId } });
    if (!(await verifyPassword(dto.currentPassword, member.passwordHash))) {
      throw new AppException(
        ErrorCode.INVALID_CREDENTIALS,
        '目前密碼不正確',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.prisma.member.update({
      where: { id: memberId },
      data: { passwordHash: await hashPassword(dto.newPassword) },
    });
    await this.tokens.revokeAll('MEMBER', memberId);
  }

  /**
   * 刪除帳號（App Store 審核要求 App 內可自行刪除帳號）。
   * 訂單需保留做會計與售後，因此採「去識別化」：清除個資、停用登入，訂單仍可追溯。
   */
  async deleteAccount(memberId: string, password: string): Promise<void> {
    const member = await this.prisma.member.findUniqueOrThrow({ where: { id: memberId } });
    if (!(await verifyPassword(password, member.passwordHash))) {
      throw new AppException(ErrorCode.INVALID_CREDENTIALS, '密碼不正確', HttpStatus.BAD_REQUEST);
    }
    await this.prisma.$transaction([
      this.prisma.member.update({
        where: { id: memberId },
        data: {
          status: 'DELETED',
          email: `deleted+${memberId}@deleted.invalid`,
          name: '已刪除的會員',
          phone: null,
          marketingOptIn: false,
          passwordHash: await hashPassword(generateOpaqueToken()),
          deletedAt: new Date(),
        },
      }),
      this.prisma.cart.deleteMany({ where: { memberId } }),
    ]);
    await this.tokens.revokeAll('MEMBER', memberId);
  }
}
