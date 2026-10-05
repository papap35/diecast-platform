import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_CONFIG, type AppConfig } from '../../config/config.module.js';
import { AdminAuthController } from './admin-auth.controller.js';
import { AdminAuthService } from './admin-auth.service.js';
import { AdminAuthGuard, MemberAuthGuard, OptionalMemberAuthGuard } from './guards.js';
import { MemberAuthController } from './member-auth.controller.js';
import { MemberAuthService } from './member-auth.service.js';
import { TokenService } from './token.service.js';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        secret: config.JWT_SECRET,
        signOptions: { issuer: 'paddock64' },
        verifyOptions: { issuer: 'paddock64' },
      }),
    }),
  ],
  controllers: [MemberAuthController, AdminAuthController],
  providers: [
    TokenService,
    MemberAuthService,
    AdminAuthService,
    MemberAuthGuard,
    OptionalMemberAuthGuard,
    AdminAuthGuard,
  ],
  exports: [TokenService, MemberAuthGuard, OptionalMemberAuthGuard, AdminAuthGuard],
})
export class AuthModule {}
