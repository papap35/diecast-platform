'use client';

import { useEffect } from 'react';

interface Instruction {
  type: 'redirect' | 'form_post';
  url: string;
  fields: Record<string, string>;
}

/**
 * 依 API 回傳的指示導向第三方頁面（金流付款頁、超商電子地圖）：
 * redirect → 直接換頁；form_post → 以隱藏表單 POST 到第三方（綠界規格）。
 * 表單動態建立在 body 下，避免出現在結帳表單裡形成巢狀 form。
 */
export function GatewayRedirect({
  instruction,
  label,
}: {
  instruction: Instruction;
  label: string;
}) {
  useEffect(() => {
    if (instruction.type === 'redirect') {
      window.location.assign(instruction.url);
      return;
    }
    const form = document.createElement('form');
    form.method = 'post';
    form.action = instruction.url;
    form.hidden = true;
    for (const [name, value] of Object.entries(instruction.fields)) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.append(input);
    }
    document.body.append(form);
    form.submit();
  }, [instruction]);

  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-white"
    >
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      {label}
    </div>
  );
}
