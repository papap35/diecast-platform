import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CheckoutForm } from '@/components/checkout-form';
import { redirect } from '@/i18n/navigation';
import { pageLocale } from '@/i18n/page-locale';
import { serverApi } from '@/lib/api';
import { hasSession } from '@/lib/session';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/checkout'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'checkout' });
  return { title: t('title'), robots: { index: false } };
}

export default async function CheckoutPage({
  params,
  searchParams,
}: PageProps<'/[locale]/checkout'>) {
  const locale = await pageLocale(params);
  const query = await searchParams;
  const buyNowId = typeof query.buyNow === 'string' ? query.buyNow : undefined;
  const quantity = Math.max(1, Math.min(99, Number(query.qty) || 1));
  const self = buyNowId ? `/checkout?buyNow=${buyNowId}&qty=${quantity}` : '/checkout';
  if (!(await hasSession())) redirect({ href: `/login?next=${encodeURIComponent(self)}`, locale });

  const t = await getTranslations('checkout');
  const api = await serverApi(locale);
  const [cartResult, me] = await Promise.all([
    buyNowId
      ? api.POST('/v1/cart/quote', {
          params: { query: { locale } },
          body: { items: [{ productId: buyNowId, quantity }] },
        })
      : api.GET('/v1/cart', { params: { query: { locale } } }),
    api.GET('/v1/me'),
  ]);

  const cart = cartResult.data;
  if (!cart || cart.items.length === 0 || !me.data) redirect({ href: '/cart', locale });

  return (
    <div className="container-page py-10">
      <h1 className="display mb-8 text-3xl sm:text-4xl">{t('title')}</h1>
      <CheckoutForm
        cart={cart!}
        profile={me.data!}
        buyNow={buyNowId ? { productId: buyNowId, quantity } : undefined}
      />
    </div>
  );
}
