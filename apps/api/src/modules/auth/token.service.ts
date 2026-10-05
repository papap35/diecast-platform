import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { APP_CONFIG, type AppConfig } from '../../config/config.module.js';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { generateOpaqueToken, sha256 } from '../../common/security/random.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { AuthSubject } from '../../generated/prisma/client.js';
import type { TokenPairDto } from './dto/token.dto.js';

export type Audience = 'member' | 'admin';

const AUDIENCE_BY_SUBJECT: Record<AuthSubject, Audience> = { MEMBER: 'member', ADMIN: 'admin' };

export interface AccessTokenPayload {
  sub: string;
  aud: Audience;
  typ: 'access';
}

export interface ClientInfo {
  userAgent?: string;
  ip?: string;
}

/**
 * 權杖策略：
 * - Access token：短效 JWT（預設 15 分鐘），無狀態驗證，Web／Admin／App 一律放在 Authorization header。
 * - Refresh token：長效不透明亂碼，只在資料庫存 SHA-256 雜湊。每次刷新都輪替，
 *   舊 token 再被使用代表可能外洩，整個 family 立即作廢（refresh token rotation + reuse detection）。
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async issue(
    subjectType: AuthSubject,
    subjectId: string,
    client: ClientInfo = {},
  ): Promise<TokenPairDto> {
    return this.createSession(subjectType, subjectId, randomUUID(), client);
  }

  async rotate(
    subjectType: AuthSubject,
    refreshToken: string,
    client: ClientInfo = {},
  ): Promise<TokenPairDto> {
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: sha256(refreshToken) },
    });

    if (!session || session.subjectType !== subjectType) {
      throw AppException.unauthorized(ErrorCode.TOKEN_INVALID, '登入已失效，請重新登入');
    }

    if (session.revokedAt || session.rotatedAt) {
      await this.revokeFamily(session.familyId);
      throw AppException.unauthorized(
        ErrorCode.TOKEN_REUSED,
        '偵測到登入權杖重複使用，已登出所有裝置',
      );
    }

    if (session.expiresAt <= new Date()) {
      throw AppException.unauthorized(ErrorCode.TOKEN_INVALID, '登入已過期，請重新登入');
    }

    // 條件式更新避免同一個 refresh token 被並發請求同時兌換
    const { count } = await this.prisma.authSession.updateMany({
      where: { id: session.id, rotatedAt: null, revokedAt: null },
      data: { rotatedAt: new Date() },
    });
    if (count === 0) {
      await this.revokeFamily(session.familyId);
      throw AppException.unauthorized(
        ErrorCode.TOKEN_REUSED,
        '偵測到登入權杖重複使用，已登出所有裝置',
      );
    }

    return this.createSession(subjectType, session.subjectId, session.familyId, client);
  }

  /** 從 refresh token 找出所屬帳號（刷新前檢查帳號狀態用） */
  async findSubjectId(subjectType: AuthSubject, refreshToken: string): Promise<string | null> {
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      select: { subjectType: true, subjectId: true },
    });
    return session?.subjectType === subjectType ? session.subjectId : null;
  }

  async revoke(refreshToken: string): Promise<void> {
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      select: { familyId: true },
    });
    if (session) await this.revokeFamily(session.familyId);
  }

  async revokeAll(subjectType: AuthSubject, subjectId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { subjectType, subjectId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  verifyAccessToken(token: string, audience: Audience): AccessTokenPayload {
    try {
      const payload = this.jwt.verify<AccessTokenPayload>(token, { audience });
      if (payload.typ !== 'access') throw new Error('wrong token type');
      return payload;
    } catch {
      throw AppException.unauthorized(ErrorCode.TOKEN_INVALID, '登入已失效，請重新登入');
    }
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createSession(
    subjectType: AuthSubject,
    subjectId: string,
    familyId: string,
    client: ClientInfo,
  ): Promise<TokenPairDto> {
    const audience = AUDIENCE_BY_SUBJECT[subjectType];
    const accessToken = await this.jwt.signAsync(
      { typ: 'access' },
      { subject: subjectId, audience, expiresIn: this.config.ACCESS_TOKEN_TTL_SECONDS },
    );

    const refreshToken = generateOpaqueToken();
    const refreshTokenExpiresAt = new Date(
      Date.now() + this.config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.authSession.create({
      data: {
        subjectType,
        subjectId,
        familyId,
        tokenHash: sha256(refreshToken),
        expiresAt: refreshTokenExpiresAt,
        userAgent: client.userAgent?.slice(0, 255),
        ip: client.ip,
      },
    });

    return {
      accessToken,
      accessTokenExpiresIn: this.config.ACCESS_TOKEN_TTL_SECONDS,
      refreshToken,
      refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
    };
  }
}
