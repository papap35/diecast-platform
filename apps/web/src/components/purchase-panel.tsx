'use client';

import type { Schemas } from '@paddock64/api-client';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { setCartItemAction } from '@/app/actions/cart';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { Countdown } from './countdown';
import { CheckIcon } from './icons';
import { Button } from './ui/button';

type Product = Schemas['ProductDetailDto'];

const PURCHASABLE = new Set(['IN_STOCK', 'LOW_STOCK', 'PREORDER_OPEN']);

export function PurchasePanel({
  product,
  loggedIn,
  serverNow,
}: {
  product: Product;
  loggedIn: boolean;
  serverNow: number;
}) {
  const t = useTranslations('product');
  const te = useTranslations('errors');
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const [quantity, setQuantity] = useState(1);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const purchasable = PURCHASABLE.has(product.availability);
  const maxQuantity = Math.max(1, Math.min(product.purchaseLimit ?? 10, product.remaining ?? 10));

  const requireLogin = () => router.push(`/login?next=${encodeURIComponent(pathname)}`);

  const addToCart = () => {
    if (!loggedIn) return requireLogin();
    startTransition(async () => {
      const result = await setCartItemAction(product.id, quantity, locale);
      if (result.ok) setMessage({ ok: true, text: t('added') });
      else if (result.error.code === 'UNAUTHORIZED') requireLogin();
      else
        setMessage({
          ok: false,
          text: te.has(result.error.code) ? te(result.error.code) : result.error.message,
        });
    });
  };

  const buyNow = () => {
    if (!loggedIn) return requireLogin();
    router.push(`/checkout?buyNow=${product.id}&qty=${quantity}`);
  };

  if (product.availability === 'COMING_SOON' && product.releaseAt) {
    return (
      <div className="space-y-4 rounded-2xl bg-ink p-5 text-white">
        <p className="text-sm text-white/70">{t('releasesIn')}</p>
        <Countdown target={product.releaseAt} serverNow={serverNow} onElapsedReload />
        <Button variant="secondary" size="lg" className="w-full" disabled>
          {t('notReleased')}
        </Button>
      </div>
    );
  }

  if (!purchasable) {
    return (
      <Button variant="secondary" size="lg" className="w-full" disabled>
        {product.availability === 'PREORDER_CLOSED' ? t('preorderClosed') : t('soldOut')}
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label htmlFor="quantity" className="text-sm text-mute">
          {t('quantity')}
        </label>
        <div className="flex h-11 items-center rounded-full border border-line-strong bg-surface">
          <button
            type="button"
            className="h-full w-11 text-lg disabled:text-faint"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            aria-label="-"
          >
            −
          </button>
          <input
            id="quantity"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/\D/g, ''));
              setQuantity(Math.min(maxQuantity, Math.max(1, n || 1)));
            }}
            className="tabular h-full w-12 bg-transparent text-center font-semibold focus:outline-none"
          />
          <button
            type="button"
            className="h-full w-11 text-lg disabled:text-faint"
            onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
            disabled={quantity >= maxQuantity}
            aria-label="+"
          >
            +
          </button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" size="lg" onClick={addToCart} disabled={pending}>
          {loggedIn ? t('addToCart') : t('loginToBuy')}
        </Button>
        <Button variant="accent" size="lg" onClick={buyNow} disabled={pending}>
          {t('buyNow')}
        </Button>
      </div>
      {message ? (
        <p
          role="status"
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${message.ok ? 'bg-ok-soft text-ok' : 'bg-accent-soft text-accent'}`}
        >
          {message.ok ? <CheckIcon size={16} /> : null}
          {message.text}
          {message.ok ? (
            <Link href="/cart" className="ml-auto font-semibold underline underline-offset-4">
              {t('viewCart')}
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
