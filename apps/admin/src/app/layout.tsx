import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { Barlow_Condensed, Noto_Sans_SC, Noto_Sans_TC } from 'next/font/google';
import './globals.css';

const display = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700'],
  style: ['italic'],
  variable: '--font-display-latin',
});
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  return {
    title: { default: t('title'), template: `%s｜${t('title')}` },
    robots: { index: false, follow: false },
  };
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const locale = await getLocale();
  const body = locale === 'zh-CN' ? bodySC : bodyTC;
  return (
    <html lang={locale} className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
