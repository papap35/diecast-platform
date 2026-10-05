import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthForm } from '@/components/auth-form';
import { redirect } from '@/i18n/navigation';
import { pageLocale } from '@/i18n/page-locale';
import { hasSession } from '@/lib/session';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/register'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('registerTitle'), robots: { index: false } };
}

export default async function Page({ params, searchParams }: PageProps<'/[locale]/register'>) {
  const locale = await pageLocale(params);
  const t = await getTranslations('auth');
  const { next } = await searchParams;
  const nextPath =
    typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : undefined;
  if (await hasSession()) redirect({ href: nextPath ?? '/account', locale });

  return (
    <div className="container-page flex justify-center py-16">
      <div className="w-full max-w-md rounded-3xl bg-surface p-7 shadow-card ring-1 ring-line sm:p-10">
        <h1 className="display text-3xl">{t('registerTitle')}</h1>
        <p className="mt-2 mb-8 text-sm text-mute">{t('registerSubtitle')}</p>
        <AuthForm mode="register" next={nextPath} />
      </div>
    </div>
  );
}
