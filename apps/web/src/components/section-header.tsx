import { Link } from '@/i18n/navigation';
import { ArrowRightIcon } from './icons';
import type { ReactNode } from 'react';

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="display text-2xl sm:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-mute">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** 區塊標題右側的「查看全部」連結 */
export function ViewAllLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink"
    >
      {label}
      <ArrowRightIcon size={16} />
    </Link>
  );
}
