import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { SearchIcon } from './icons';

/** 搜尋框（純表單 GET，不需要 JavaScript 也能運作） */
export function SearchForm({
  action,
  defaultValue,
  className,
}: {
  action: string;
  defaultValue?: string;
  className?: string;
}) {
  const t = useTranslations('nav');
  return (
    <form action={action} method="get" role="search" className={cn('relative', className)}>
      <SearchIcon
        size={18}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-mute"
      />
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={t('search')}
        aria-label={t('search')}
        className="h-10 w-full rounded-full border border-line bg-paper pr-4 pl-10 text-sm placeholder:text-faint focus:border-ink focus:bg-surface focus:outline-none"
      />
    </form>
  );
}
