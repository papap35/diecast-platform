import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Barlow_Condensed, Noto_Sans_SC, Noto_Sans_TC } from 'next/font/google';
import { notFound } from 'next/navigation';
import { CollectorProvider } from '@/components/collector-context';
import { AnnouncementBar, Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { routing } from '@/i18n/routing';
import { SITE_URL } from '@/lib/env';
import { memberState } from '@/lib/member-state';
import '../globals.css';

const display = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display-latin',
});

// 中文字型檔很大，不預載；瀏覽器只會下載實際用到字元的分段檔
const bodyTC = Noto_Sans_TC({
  weight: ['400', '500', '700'],
  variable: '--font-body',
  preload: false,
});
const bodySC = Noto_Sans_SC({
  weight: ['400', '500', '700'],
  variable: '--font-body',
  preload: false,
});

const HTML_LANG: Record<string, string> = {
  'zh-TW': 'zh-Hant-TW',
  'zh-CN': 'zh-Hans-CN',
  en: 'en',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t('title'), template: `%s｜Paddock 64` },
    description: t('description'),
    alternates: {
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
    },
    openGraph: { siteName: 'Paddock 64', type: 'website', locale },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const body = locale === 'zh-CN' ? bodySC : bodyTC;
  const member = await memberState(locale);
  return (
    <html lang={HTML_LANG[locale]} className={`${display.variable} ${body.variable}`}>
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider>
          {/* 登入狀態改變時重新掛載，載入新會員的願望清單與提醒 */}
          <CollectorProvider
            key={member.loggedIn ? 'member' : 'guest'}
            loggedIn={member.loggedIn}
            wishlistIds={member.wishlistIds}
            reminderIds={member.reminderIds}
          >
            <AnnouncementBar />
            <Header locale={locale} />
            <main className="flex-1">{children}</main>
            <Footer />
          </CollectorProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
