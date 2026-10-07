import { HttpStatus } from '@nestjs/common';
import type { AppConfig } from '../../config/config.module.js';
import { AppException, ErrorCode } from '../errors/app-exception.js';

/** 公開示範環境（DEMO_MODE）的示範帳號不能改密碼、停用或刪除 */
export function assertNotDemoAccount(
  config: Pick<AppConfig, 'DEMO_MODE' | 'DEMO_ACCOUNTS'>,
  email: string,
): void {
  if (config.DEMO_MODE && config.DEMO_ACCOUNTS.includes(email.toLowerCase())) {
    throw new AppException(
      ErrorCode.DEMO_ACCOUNT_LOCKED,
      '示範帳號不能修改密碼、停用或刪除，想完整體驗請另外註冊帳號',
      HttpStatus.FORBIDDEN,
    );
  }
}
