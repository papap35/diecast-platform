import { ValidationPipe, type ValidationError } from '@nestjs/common';
import { AppException, ErrorCode } from './app-exception.js';

export interface FieldError {
  field: string;
  messages: string[];
}

function flatten(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = error.constraints ? [{ field, messages: Object.values(error.constraints) }] : [];
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

/** 全域驗證：移除未宣告欄位、拒絕多餘欄位，錯誤統一轉成 VALIDATION_FAILED + 欄位明細 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    exceptionFactory: (errors) =>
      AppException.badRequest(ErrorCode.VALIDATION_FAILED, '輸入資料格式錯誤', flatten(errors)),
  });
}
