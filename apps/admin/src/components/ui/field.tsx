import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const inputClass =
  'h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-faint focus:border-ink focus:outline-none disabled:bg-canvas disabled:text-mute aria-[invalid=true]:border-accent';

export function Field({
  label,
  name,
  error,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  name: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={name} className="text-xs font-semibold text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-accent">{error}</p>
      ) : hint ? (
        <p className="text-xs text-mute">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-lg border border-line-strong bg-surface p-3 text-sm placeholder:text-faint focus:border-ink focus:outline-none disabled:bg-canvas',
        className,
      )}
      {...props}
    />
  );
}

export function Checkbox({ label, ...props }: ComponentProps<'input'> & { label: ReactNode }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-ink-2">
      <input type="checkbox" className="h-4 w-4 accent-ink" {...props} />
      {label}
    </label>
  );
}
