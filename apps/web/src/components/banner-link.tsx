import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

/** 橫幅連結：站內路徑走語系路由，外部網址開新分頁 */
export function BannerLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
