import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { ChangePasswordForm } from '@/components/system-forms';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('account');
  return { title: t('title') };
}

export default async function ChangePasswordPage() {
  const t = await getTranslations('account');
  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <ChangePasswordForm />
    </>
  );
}
