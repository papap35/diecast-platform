import { IsString, MinLength } from 'class-validator';

export class TokenPairDto {
  /** 短效 JWT，放在 `Authorization: Bearer <token>` */
  accessToken!: string;
  /** access token 有效秒數 */
  accessTokenExpiresIn!: number;
  /** 用來換發新 access token 的長效權杖；每次刷新都會輪替 */
  refreshToken!: string;
  refreshTokenExpiresAt!: string;
}

export class RefreshTokenDto {
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}
