import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-ink-2 disabled:bg-faint',
  secondary: 'bg-surface text-ink ring-1 ring-line-strong hover:ring-ink disabled:text-faint',
  ghost: 'text-ink-2 hover:bg-black/5 hover:text-ink',
  danger: 'bg-surface text-accent ring-1 ring-accent/30 hover:bg-accent-soft',
};

const SIZES: Record<Size, string> = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm' };

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(
    'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
