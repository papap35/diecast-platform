import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { UnsubscribeForm } from '@/components/unsubscribe-form';
import { pageLocale } from '@/i18n/page-locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/unsubscribe'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'unsubscribe' });
  return { title: t('title'), robots: { index: false } };
}

/** 電子報退訂確認頁（信中連結開啟；按下按鈕才退訂，避免信箱的連結預覽誤觸） */
export default async function UnsubscribePage({
  params,
  searchParams,
}: PageProps<'/[locale]/unsubscribe'>) {
  await pageLocale(params);
  const t = await getTranslations('unsubscribe');
  const { token } = await searchParams;
  return (
    <div className="container-page flex justify-center py-16">
      <div className="w-full max-w-md space-y-5 rounded-3xl bg-surface p-8 ring-1 ring-line">
        <h1 className="display text-2xl">{t('title')}</h1>
        {typeof token === 'string' && token ? (
          <UnsubscribeForm token={token} />
        ) : (
          <p className="text-sm text-mute">{t('missing')}</p>
        )}
      </div>
    </div>
  );
}
