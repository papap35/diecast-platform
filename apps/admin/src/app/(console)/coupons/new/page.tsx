import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CouponForm } from '@/components/coupon-form';
import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { can, getAdmin } from '@/lib/permissions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('coupons');
  return { title: t('new') };
}

export default async function NewCouponPage() {
  const t = await getTranslations('coupons');
  if (!can(await getAdmin(), 'marketing:write')) return <NoAccess title={t('new')} />;
  return (
    <>
      <Link href="/coupons" className="mb-3 inline-block text-sm text-mute hover:text-ink">
        ← {t('title')}
      </Link>
      <PageHeader title={t('new')} />
      <CouponForm />
    </>
  );
}
