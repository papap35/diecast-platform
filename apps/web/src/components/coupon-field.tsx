'use client';

import type { Schemas } from '@paddock64/api-client';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useTransition } from 'react';
import { previewCouponAction } from '@/app/actions/checkout';
import type { ActionError } from '@/lib/action-result';
import { formatPrice } from '@/lib/format';
import { CloseIcon, TagIcon } from './icons';

type ShippingMethod = Schemas['ShippingOptionDto']['method'];
export type CouponPreview = Schemas['CouponPreviewDto'];
export interface AppliedCoupon {
  preview: CouponPreview;
  /** 試算時的配送方式（換配送方式要重新試算，運費與免運門檻不同） */
  method: ShippingMethod;
}

/** 結帳頁的優惠碼欄位：套用前先向 API 試算，換配送方式時自動重新試算 */
export function CouponField({
  method,
  buyNow,
  applied,
  onChange,
  initialCode,
}: {
  method: ShippingMethod;
  buyNow?: { productId: string; quantity: number };
  applied: AppliedCoupon | null;
  onChange: (coupon: AppliedCoupon | null) => void;
  /** 從超商電子地圖回來時，前往前已套用的優惠碼 */
  initialCode?: string;
}) {
  const t = useTranslations('checkout');
  const te = useTranslations('errors');
  const [code, setCode] = useState('');
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useTransition();

  const apply = (value: string, shippingMethod: ShippingMethod) =>
    startTransition(async () => {
      const result = await previewCouponAction({ code: value, shippingMethod, buyNow });
      if (result.ok) {
        setError(null);
        onChange({ preview: result.data, method: shippingMethod });
      } else {
        setError(result.error);
        onChange(null);
      }
    });

  // 選完門市回到結帳頁：重新試算前往電子地圖前套用的優惠碼
  useEffect(() => {
    if (initialCode) apply(initialCode, method);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在進入頁面時執行一次
  }, []);

  // 換配送方式：已套用的優惠券重新試算（免運券可能變成不需要、折後金額可能低於免運門檻）
  const lastMethod = useRef(method);
  useEffect(() => {
    if (lastMethod.current === method) return;
    lastMethod.current = method;
    if (applied) apply(applied.preview.code, method);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在配送方式改變時重新試算
  }, [method]);

  const message = (e: ActionError) => {
    const details = e.details as { minSubtotal?: number; eligibleSubtotal?: number } | undefined;
    if (e.code === 'COUPON_MIN_SUBTOTAL' && details?.minSubtotal !== undefined) {
      return t('couponMinSubtotal', {
        amount: formatPrice(details.minSubtotal - (details.eligibleSubtotal ?? 0)),
      });
    }
    return te.has(e.code) ? te(e.code) : e.message;
  };

  if (applied) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-ok-soft px-3 py-2.5 text-sm">
        <TagIcon size={16} className="shrink-0 text-ok" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ok">{applied.preview.code}</p>
          <p className="truncate text-xs text-ink-2">{applied.preview.name}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setCode('');
          }}
          className="rounded-full p-1 text-mute hover:bg-black/5 hover:text-ink"
          aria-label={t('couponRemove')}
        >
          <CloseIcon size={16} />
        </button>
        <input type="hidden" name="couponCode" value={applied.preview.code} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <label htmlFor="coupon" className="sr-only">
          {t('coupon')}
        </label>
        <input
          id="coupon"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => {
            // Enter 套用優惠碼，而不是送出整張結帳表單
            if (event.key === 'Enter') {
              event.preventDefault();
              if (code.trim()) apply(code, method);
            }
          }}
          placeholder={t('couponPlaceholder')}
          autoComplete="off"
          aria-invalid={!!error}
          aria-describedby={error ? 'coupon-error' : undefined}
          className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 text-sm uppercase placeholder:normal-case placeholder:text-faint focus:border-ink focus:outline-none aria-[invalid=true]:border-accent"
        />
        <button
          type="button"
          disabled={!code.trim() || pending}
          onClick={() => apply(code, method)}
          className="h-10 shrink-0 rounded-xl bg-ink px-4 text-sm font-semibold text-white disabled:opacity-40"
        >
          {pending ? t('couponApplying') : t('couponApply')}
        </button>
      </div>
      {error ? (
        <p id="coupon-error" role="alert" className="text-xs text-accent">
          {message(error)}
        </p>
      ) : null}
    </div>
  );
}
