import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CartLine } from '@/components/cart-line';
import { ButtonLink } from '@/components/ui/button';
import { redirect } from '@/i18n/navigation';
import { pageLocale } from '@/i18n/page-locale';
import { serverApi } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { hasSession } from '@/lib/session';

export async function generateMetadata({ params }: PageProps<'/[locale]/cart'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'cart' });
  return { title: t('title'), robots: { index: false } };
}

export default async function CartPage({ params }: PageProps<'/[locale]/cart'>) {
  const locale = await pageLocale(params);
  if (!(await hasSession())) redirect({ href: '/login?next=/cart', locale });
  const t = await getTranslations('cart');
  const api = await serverApi(locale);
  const { data: cart } = await api.GET('/v1/cart', { params: { query: { locale } } });

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="display text-3xl">{t('empty')}</h1>
        <p className="mt-2 text-sm text-mute">{t('emptyHint')}</p>
        <ButtonLink href="/products" className="mt-8">
          {t('continue')}
        </ButtonLink>
      </div>
    );
  }

  const cvs = cart.shippingOptions.find((option) => option.method === 'CVS_711');
  const gap = cvs ? cvs.freeThreshold - cart.subtotal : 0;

  return (
    <div className="container-page py-10">
      <h1 className="display mb-8 text-3xl sm:text-4xl">{t('title')}</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <ul className="divide-y divide-line rounded-3xl bg-surface px-5 ring-1 ring-line sm:px-7">
          {cart.items.map((line) => (
            <CartLine key={line.product.id} line={line} />
          ))}
        </ul>
        <aside className="h-fit space-y-4 rounded-3xl bg-surface p-6 ring-1 ring-line lg:sticky lg:top-24">
          <div className="flex justify-between text-sm">
            <span className="text-mute">{t('subtotal')}</span>
            <span className="font-bold tabular">{formatPrice(cart.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-mute">{t('shipping')}</span>
            <span className="text-ink-2">{t('shippingCalculated')}</span>
          </div>
          <div className="rounded-xl bg-paper p-3 text-xs text-ink-2">
            {gap > 0
              ? t('freeShippingHint', { amount: gap.toLocaleString('en-US') })
              : t('freeShippingReached')}
            {cvs ? (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-ok"
                  style={{ width: `${Math.min(100, (cart.subtotal / cvs.freeThreshold) * 100)}%` }}
                />
              </div>
            ) : null}
          </div>
          {cart.hasIssues ? (
            <p className="text-xs font-medium text-accent">
              {cart.preorderMixed ? t('preorderMixed') : t('fixIssues')}
            </p>
          ) : null}
          {cart.hasIssues ? (
            <span className="flex h-13 w-full items-center justify-center rounded-full bg-faint text-sm font-semibold text-white">
              {t('checkout')}
            </span>
          ) : (
            <ButtonLink href="/checkout" variant="accent" size="lg" className="w-full">
              {t('checkout')}
            </ButtonLink>
          )}
          <ButtonLink href="/products" variant="ghost" className="w-full">
            {t('continue')}
          </ButtonLink>
        </aside>
      </div>
    </div>
  );
}
