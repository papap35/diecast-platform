'use client';

import type { Schemas } from '@paddock64/api-client';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { removeCartItemAction, setCartItemAction } from '@/app/actions/cart';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';

type Line = Schemas['CartItemDto'];

export function CartLine({ line }: { line: Line }) {
  const t = useTranslations('cart');
  const te = useTranslations('errors');
  const locale = useLocale() as AppLocale;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { product } = line;

  const update = (quantity: number) =>
    startTransition(async () => {
      setError(null);
      const result =
        quantity <= 0
          ? await removeCartItemAction(product.id, locale)
          : await setCartItemAction(product.id, quantity, locale);
      if (!result.ok)
        setError(te.has(result.error.code) ? te(result.error.code) : result.error.message);
    });

  return (
    <li className={cn('flex gap-4 py-5', pending && 'opacity-60')}>
      <Link
        href={`/products/${product.slug}`}
        className="relative aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-xl bg-paper ring-1 ring-line sm:w-36"
      >
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            unoptimized
            sizes="150px"
            className="object-cover"
          />
        ) : null}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-xs font-semibold tracking-wide text-mute uppercase">
          {product.brand.name}
        </span>
        <Link
          href={`/products/${product.slug}`}
          className="line-clamp-2 text-sm font-semibold hover:underline"
        >
          {product.name}
        </Link>
        <span className="text-sm text-ink-2 tabular">{formatPrice(product.price)}</span>
        {line.issue ? (
          <span className="text-xs font-medium text-accent">{t(`issues.${line.issue}`)}</span>
        ) : null}
        {error ? <span className="text-xs font-medium text-accent">{error}</span> : null}
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
          <div className="flex h-9 items-center rounded-full border border-line-strong bg-surface text-sm">
            <button
              type="button"
              className="h-full w-9 disabled:text-faint"
              disabled={pending}
              onClick={() => update(line.quantity - 1)}
              aria-label="-"
            >
              −
            </button>
            <span className="tabular w-8 text-center font-semibold">{line.quantity}</span>
            <button
              type="button"
              className="h-full w-9 disabled:text-faint"
              disabled={pending || line.quantity >= line.maxQuantity}
              onClick={() => update(line.quantity + 1)}
              aria-label="+"
            >
              +
            </button>
          </div>
          <button
            type="button"
            className="text-xs font-semibold text-mute underline underline-offset-4 hover:text-ink"
            disabled={pending}
            onClick={() => update(0)}
          >
            {t('remove')}
          </button>
          {line.maxQuantity > 0 && line.quantity >= line.maxQuantity ? (
            <span className="text-xs text-mute">
              {t('maxQuantity', { count: line.maxQuantity })}
            </span>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 text-right text-sm font-bold tabular">
        {formatPrice(line.lineTotal)}
      </div>
    </li>
  );
}
