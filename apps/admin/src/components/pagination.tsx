import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { buttonClass } from './ui/button';

/** 以目前查詢參數為基礎產生上一頁／下一頁連結 */
export async function Pagination({
  basePath,
  params,
  page,
  totalPages,
  total,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  totalPages: number;
  total: number;
}) {
  const t = await getTranslations('common');
  const href = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params))
      if (value && key !== 'page') query.set(key, value);
    if (target > 1) query.set('page', String(target));
    const qs = query.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs text-mute">
      <span>{t('page', { page, total: totalPages, count: total })}</span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={buttonClass('secondary', 'sm')}>
            {t('prev')}
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link href={href(page + 1)} className={buttonClass('secondary', 'sm')}>
            {t('next')}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
