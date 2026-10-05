import 'server-only';
import { cookies } from 'next/headers';
import { cookieOptions } from './session';

const DRAFT_COOKIE = 'p64_checkout_draft';
const DRAFT_FIELDS = [
  'recipientName',
  'recipientPhone',
  'recipientEmail',
  'invoiceType',
  'invoiceCarrierNum',
  'invoiceDonationCode',
  'invoiceTaxId',
  'invoiceTitle',
  'note',
] as const;

export type CheckoutDraft = Partial<Record<(typeof DRAFT_FIELDS)[number], string>>;

/**
 * 前往超商電子地圖前暫存已填寫的結帳資料（httpOnly cookie，30 分鐘），
 * 選好門市回到結帳頁時由伺服器帶回表單，不必重新填寫。
 */
export async function saveCheckoutDraft(formData: FormData): Promise<void> {
  const draft: CheckoutDraft = {};
  for (const field of DRAFT_FIELDS) {
    const value = formData.get(field);
    if (typeof value === 'string' && value.trim()) draft[field] = value.trim().slice(0, 200);
  }
  (await cookies()).set(
    DRAFT_COOKIE,
    Buffer.from(JSON.stringify(draft)).toString('base64url'),
    cookieOptions(30 * 60),
  );
}

export async function readCheckoutDraft(): Promise<CheckoutDraft | undefined> {
  const raw = (await cookies()).get(DRAFT_COOKIE)?.value;
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    return Object.fromEntries(
      DRAFT_FIELDS.flatMap((field) =>
        typeof parsed[field] === 'string' ? [[field, parsed[field]]] : [],
      ),
    ) as CheckoutDraft;
  } catch {
    return undefined;
  }
}
