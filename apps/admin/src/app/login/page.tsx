import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from '@/components/login-form';
import { Logo } from '@/components/logo';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('login');
  return { title: t('title') };
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const t = await getTranslations('login');
  const { next, passwordChanged } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-8 shadow-2xl">
        <Logo />
        <h1 className="mt-6 text-xl font-bold">{t('title')}</h1>
        <p className="mb-6 text-sm text-mute">{t('subtitle')}</p>
        {passwordChanged ? (
          <p role="status" className="mb-4 rounded-lg bg-ok-soft px-3 py-2 text-xs text-ok">
            {t('passwordChanged')}
          </p>
        ) : null}
        <LoginForm next={typeof next === 'string' ? next : undefined} />
      </div>
    </div>
  );
}
