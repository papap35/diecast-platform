import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { OrderList } from '@/components/order-list';
import { pageLocale } from '@/i18n/page-locale';
import { serverApi } from '@/lib/api';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/account/orders'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'orders' });
  return { title: t('title'), robots: { index: false } };
}

export default async function OrdersPage({ params }: PageProps<'/[locale]/account/orders'>) {
  const locale = await pageLocale(params);
  const t = await getTranslations('orders');
  const api = await serverApi(locale);
  const { data } = await api.GET('/v1/orders', { params: { query: { pageSize: 50 } } });

  return (
    <div className="space-y-6">
      <h1 className="display text-3xl sm:text-4xl">{t('title')}</h1>
      <OrderList orders={data?.data ?? []} />
    </div>
  );
}
