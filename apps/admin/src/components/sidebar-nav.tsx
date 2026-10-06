'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import {
  BoxIcon,
  CalendarIcon,
  ClockIcon,
  FolderIcon,
  GridIcon,
  MegaphoneIcon,
  ReceiptIcon,
  ShieldIcon,
  TagIcon,
  UserIcon,
  UsersIcon,
} from './icons';

const ICONS = {
  grid: GridIcon,
  box: BoxIcon,
  tag: TagIcon,
  folder: FolderIcon,
  receipt: ReceiptIcon,
  users: UsersIcon,
  user: UserIcon,
  shield: ShieldIcon,
  clock: ClockIcon,
  calendar: CalendarIcon,
  megaphone: MegaphoneIcon,
};

export interface NavGroup {
  label?: string;
  items: { href: string; label: string; icon: keyof typeof ICONS }[];
}

export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-6">
      {groups.map((group, index) => (
        <div key={group.label ?? index} className="flex flex-col gap-1">
          {group.label ? (
            <p className="px-3 pb-1 text-[11px] font-semibold tracking-widest text-white/40 uppercase">
              {group.label}
            </p>
          ) : null}
          {group.items.map((item) => {
            const Icon = ICONS[item.icon];
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-white text-ink' : 'text-white/70 hover:bg-white/10 hover:text-white',
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
