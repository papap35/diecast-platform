import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const inputClass =
  'h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-sm text-ink placeholder:text-faint transition-colors focus:border-ink focus:outline-none aria-[invalid=true]:border-accent';

interface FieldProps {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children?: ReactNode;
  className?: string;
}

/** 表單欄位外框：標籤、提示與錯誤訊息 */
export function Field({ label, name, error, hint, children, className }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={name} className="text-sm font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="text-xs text-accent">
          {error}
        </p>
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
  return <select className={cn(inputClass, 'appearance-none pr-9', className)} {...props} />;
}
