import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit';

/** 操作紀錄的資料類型；後台依此產生連結 */
export type AuditTarget =
  | 'AdminUser'
  | 'Role'
  | 'Product'
  | 'Brand'
  | 'Category'
  | 'Order'
  | 'Member'
  | 'Event'
  | 'Banner'
  | 'Coupon'
  | 'Campaign'
  | 'Setting'
  | 'EmailMessage';

export interface AuditMeta {
  /** 動作代碼，例如 product.update */
  action: string;
  target: AuditTarget;
}

/**
 * 後台寫入 API 成功後記到操作紀錄。
 * 目標 id 取路由參數 :id，新增資料時取回應的 id；送出的內容會遮蔽密碼等欄位後一併保存。
 */
export const Audit = (action: string, target: AuditTarget) =>
  SetMetadata(AUDIT_KEY, { action, target } satisfies AuditMeta);

const SENSITIVE_KEY = /password|token|secret/i;
const MAX_STRING = 300;
const MAX_ITEMS = 50;
const MAX_DEPTH = 4;
const MAX_JSON = 16_000;

/** 遮蔽敏感欄位、截斷過長內容，避免操作紀錄變成另一個外洩來源 */
export function sanitizeForAudit(value: unknown): unknown {
  const clean = sanitize(value, 0);
  return JSON.stringify(clean).length > MAX_JSON ? { omitted: 'too_large' } : clean;
}

function sanitize(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  }
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return '…';
  if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map((v) => sanitize(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [
      key,
      SENSITIVE_KEY.test(key) ? '[REDACTED]' : sanitize(v, depth + 1),
    ]),
  );
}

const LABEL_KEYS = ['orderNo', 'email', 'sku', 'code', 'name', 'title', 'slug', 'key'] as const;

/** 從回應或送出的內容找一個人看得懂的辨識文字（訂單編號、Email、SKU…） */
export function labelOf(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  for (const key of LABEL_KEYS) {
    const label = record[key];
    if (typeof label === 'string' && label.trim()) return label.trim().slice(0, 120);
  }
  return null;
}

export function idOf(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const id = (value as Record<string, unknown>).id;
  return typeof id === 'string' ? id : null;
}
