'use client';

import type { Schemas } from '@paddock64/api-client';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

/**
 * 依 API 回傳的付款指示導向金流頁：
 * redirect → 直接換頁；form_post → 以隱藏表單 POST 到金流商（綠界規格）。
 */
export function PaymentRedirect({
  instruction,
}: {
  instruction: Schemas['PaymentInstructionDto'];
}) {
  const t = useTranslations('orders');
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (instruction.type === 'redirect') window.location.assign(instruction.url);
    else formRef.current?.submit();
  }, [instruction]);

  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-white"
    >
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      {t('paying')}
      {instruction.type === 'form_post' ? (
        <form ref={formRef} method="post" action={instruction.url} className="hidden">
          {Object.entries(instruction.fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
        </form>
      ) : null}
    </div>
  );
}
