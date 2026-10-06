import { twMerge } from 'tailwind-merge';

/** 合併 className（略過 falsy 值）；衝突的 Tailwind class 以後面的為準，例如 w-full + w-40 → w-40 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return twMerge(classes.filter(Boolean).join(' '));
}
