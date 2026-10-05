import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Logo } from './logo';

const API_DOCS_URL = process.env.NEXT_PUBLIC_API_DOCS_URL ?? 'http://localhost:4000/docs';
const SOURCE_URL = 'https://github.com/papap35/diecast-platform';

export async function Footer() {
  const t = await getTranslations('footer');
  const nav = await getTranslations('nav');
  const meta = await getTranslations('meta');

  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1.4fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-mute">{t('tagline')}</p>
        </div>
        <div>
          <h3 className="eyebrow mb-3">{t('shop')}</h3>
          <ul className="space-y-2 text-sm text-ink-2">
            <li>
              <Link href="/products" className="hover:text-ink">
                {nav('shop')}
              </Link>
            </li>
            <li>
              <Link href="/drops" className="hover:text-ink">
                {nav('drops')}
              </Link>
            </li>
            <li>
              <Link href="/calendar" className="hover:text-ink">
                {nav('calendar')}
              </Link>
            </li>
            <li>
              <Link href="/brands" className="hover:text-ink">
                {nav('brands')}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="eyebrow mb-3">{t('help')}</h3>
          <ul className="space-y-2 text-sm text-ink-2">
            <li>
              <Link href="/account/orders" className="hover:text-ink">
                {nav('orders')}
              </Link>
            </li>
            <li>
              <a href={API_DOCS_URL} className="hover:text-ink" target="_blank" rel="noreferrer">
                {t('apiDocs')}
              </a>
            </li>
            <li>
              <a href={SOURCE_URL} className="hover:text-ink" target="_blank" rel="noreferrer">
                {t('source')}
              </a>
            </li>
          </ul>
        </div>
        <div className="space-y-3 rounded-2xl bg-paper p-5">
          <h3 className="eyebrow">{t('about')}</h3>
          <p className="text-sm text-ink-2">{t('aboutBody')}</p>
          <p className="text-xs text-mute">{meta('demoNotice')}</p>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="container-page py-5 text-xs text-faint">
          {t('rights', { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
