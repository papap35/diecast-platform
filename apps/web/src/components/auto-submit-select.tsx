'use client';

import type { ComponentProps } from 'react';
import { Select } from './ui/field';

/** 選擇後自動送出所屬表單（排序選單用；沒有 JavaScript 時仍可按套用按鈕） */
export function AutoSubmitSelect(props: ComponentProps<'select'>) {
  return <Select {...props} onChange={(event) => event.currentTarget.form?.requestSubmit()} />;
}
