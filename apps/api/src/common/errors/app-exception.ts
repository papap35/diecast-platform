import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 對外穩定的錯誤代碼。Web、Admin 與 App 以 code 判斷錯誤類型，
 * message 只供除錯與預設顯示，不保證文字不變。
 */
export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  EMAIL_TAKEN: 'EMAIL_TAKEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_REUSED: 'TOKEN_REUSED',

  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  PRODUCT_UNAVAILABLE: 'PRODUCT_UNAVAILABLE',
  NOT_RELEASED_YET: 'NOT_RELEASED_YET',
  PREORDER_CLOSED: 'PREORDER_CLOSED',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  PURCHASE_LIMIT_EXCEEDED: 'PURCHASE_LIMIT_EXCEEDED',
  CART_EMPTY: 'CART_EMPTY',
  REMINDER_NOT_AVAILABLE: 'REMINDER_NOT_AVAILABLE',
  GARAGE_HANDLE_TAKEN: 'GARAGE_HANDLE_TAKEN',
  GARAGE_FULL: 'GARAGE_FULL',
  WISHLIST_FULL: 'WISHLIST_FULL',
  /** 預購商品需與現貨分開結帳 */
  PREORDER_SEPARATE_CHECKOUT: 'PREORDER_SEPARATE_CHECKOUT',

  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  ORDER_NOT_PAYABLE: 'ORDER_NOT_PAYABLE',
  ORDER_NOT_CANCELLABLE: 'ORDER_NOT_CANCELLABLE',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  PAYMENT_VERIFICATION_FAILED: 'PAYMENT_VERIFICATION_FAILED',
  PAYMENT_PROVIDER_DISABLED: 'PAYMENT_PROVIDER_DISABLED',

  CVS_SELECTION_NOT_FOUND: 'CVS_SELECTION_NOT_FOUND',
  SHIPMENT_NOT_ALLOWED: 'SHIPMENT_NOT_ALLOWED',
  INVOICE_NOT_RETRYABLE: 'INVOICE_NOT_RETRYABLE',
  /** 第三方服務（綠界物流、電子發票）回傳錯誤或無法連線 */
  PROVIDER_ERROR: 'PROVIDER_ERROR',

  /** 不能停用自己、變更自己的角色或移除自己的管理權限（避免把自己鎖在門外） */
  CANNOT_MODIFY_SELF: 'CANNOT_MODIFY_SELF',
  /** 至少要保留一位啟用中的超級管理員 */
  LAST_SUPER_ADMIN: 'LAST_SUPER_ADMIN',
  ROLE_KEY_TAKEN: 'ROLE_KEY_TAKEN',
  /** 還有管理員使用這個角色，或角色為系統內建 */
  ROLE_IN_USE: 'ROLE_IN_USE',
  /** 超級管理員角色擁有全部權限，不可修改 */
  ROLE_LOCKED: 'ROLE_LOCKED',

  /** 優惠碼不存在 */
  COUPON_NOT_FOUND: 'COUPON_NOT_FOUND',
  /** 優惠券已停用、尚未開始或已過期 */
  COUPON_UNAVAILABLE: 'COUPON_UNAVAILABLE',
  /** 會員等級未達優惠券的限制 */
  COUPON_TIER_REQUIRED: 'COUPON_TIER_REQUIRED',
  /** 適用商品的小計未達門檻 */
  COUPON_MIN_SUBTOTAL: 'COUPON_MIN_SUBTOTAL',
  /** 購物車沒有適用的商品，或免運券但訂單已經免運 */
  COUPON_NOT_APPLICABLE: 'COUPON_NOT_APPLICABLE',
  /** 這位會員已用完可使用次數 */
  COUPON_ALREADY_USED: 'COUPON_ALREADY_USED',
  /** 優惠券已被領完（達總使用次數上限） */
  COUPON_USED_UP: 'COUPON_USED_UP',
  COUPON_CODE_TAKEN: 'COUPON_CODE_TAKEN',
  /** 已有人使用的優惠券不能刪除（請改為停用） */
  COUPON_IN_USE: 'COUPON_IN_USE',

  /** 電子報已排程或寄出，不能修改（排程中可先取消） */
  CAMPAIGN_NOT_EDITABLE: 'CAMPAIGN_NOT_EDITABLE',
  /** 退訂連結無效 */
  UNSUBSCRIBE_INVALID: 'UNSUBSCRIBE_INVALID',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    status: HttpStatus,
    readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }

  static notFound(code: ErrorCode, message: string): AppException {
    return new AppException(code, message, HttpStatus.NOT_FOUND);
  }

  static conflict(code: ErrorCode, message: string, details?: unknown): AppException {
    return new AppException(code, message, HttpStatus.CONFLICT, details);
  }

  static badRequest(code: ErrorCode, message: string, details?: unknown): AppException {
    return new AppException(code, message, HttpStatus.BAD_REQUEST, details);
  }

  static unauthorized(
    code: ErrorCode = ErrorCode.UNAUTHORIZED,
    message = '請先登入',
  ): AppException {
    return new AppException(code, message, HttpStatus.UNAUTHORIZED);
  }

  static forbidden(message = '沒有執行此操作的權限'): AppException {
    return new AppException(ErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }
}
