import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { MembershipCard } from '@/components/membership-card';
import { OrderList } from '@/components/order-list';
import { ProfileForm } from '@/components/profile-form';
import { pageLocale } from '@/i18n/page-locale';
import { serverApi } from '@/lib/api';
import { formatDate } from '@/lib/format';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/account'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });
  return { title: t('title'), robots: { index: false } };
}

export default async function AccountPage({ params }: PageProps<'/[locale]/account'>) {
  const locale = await pageLocale(params);
  const t = await getTranslations('account');
  const api = await serverApi(locale);
  const [me, orders, membership] = await Promise.all([
    api.GET('/v1/me'),
    api.GET('/v1/orders', { params: { query: { pageSize: 3 } } }),
    api.GET('/v1/me/membership'),
  ]);
  if (!me.data) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-3xl sm:text-4xl">{t('title')}</h1>
        <p className="mt-1 text-sm text-mute">
          {me.data.name} · {t('memberSince')} {formatDate(me.data.createdAt, locale)}
        </p>
      </div>
      {membership.data ? <MembershipCard membership={membership.data} /> : null}
      <section className="rounded-3xl bg-surface p-6 ring-1 ring-line">
        <h2 className="mb-5 text-base font-semibold">{t('profile')}</h2>
        <ProfileForm profile={me.data} />
      </section>
      <section>
        <h2 className="mb-4 text-base font-semibold">{t('recentOrders')}</h2>
        <OrderList orders={orders.data?.data ?? []} />
      </section>
    </div>
  );
}
