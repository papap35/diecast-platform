import { AppException, ErrorCode } from '../errors/app-exception.js';

/** 結束時間不可早於開始時間（欄位錯誤格式與 ValidationPipe 相同） */
export function assertDateRange(
  startsAt: Date | null | undefined,
  endsAt: Date | null | undefined,
  field = 'endsAt',
): void {
  if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
    throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, '結束時間不可早於開始時間', [
      { field, messages: ['結束時間不可早於開始時間'] },
    ]);
  }
}
