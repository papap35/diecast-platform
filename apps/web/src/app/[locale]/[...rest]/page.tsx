import { notFound } from 'next/navigation';

/** 語系底下不存在的路徑交給 [locale]/not-found.tsx 顯示在地化的 404 */
export default function CatchAll() {
  notFound();
}
