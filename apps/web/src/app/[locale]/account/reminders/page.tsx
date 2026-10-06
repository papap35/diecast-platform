import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { SaleTypeBadge } from '@/components/availability-badge';
import { ReminderButton } from '@/components/collector-buttons';
import { Countdown } from '@/components/countdown';
import { ButtonLink } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { pageLocale } from '@/i18n/page-locale';
import { serverApi } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { requestTime } from '@/lib/time';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/account/reminders'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'reminders' });
  return { title: t('title'), robots: { index: false } };
}

export default async function RemindersPage({ params }: PageProps<'/[locale]/account/reminders'>) {
  const locale = await pageLocale(params);
  const t = await getTranslations('reminders');
  const api = await serverApi(locale);
  const { data } = await api.GET('/v1/me/reminders', { params: { query: { locale } } });
  const reminders = data?.data ?? [];
  const now = requestTime();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-3xl sm:text-4xl">{t('title')}</h1>
        <p className="mt-1 text-sm text-mute">{t('subtitle')}</p>
      </div>
      {reminders.length ? (
        <ul className="space-y-3">
          {reminders.map(({ product, remindAt }) => (
            <li
              key={product.id}
              className="grid items-center gap-4 rounded-2xl bg-surface p-4 ring-1 ring-line sm:grid-cols-[7rem_1fr_auto]"
            >
              <Link
                href={`/products/${product.slug}`}
                className="relative hidden aspect-[4/3] overflow-hidden rounded-xl bg-paper ring-1 ring-line sm:block"
              >
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt=""
                    fill
                    unoptimized
                    sizes="112px"
                    className="object-cover"
                  />
                ) : null}
              </Link>
              <div className="min-w-0 space-y-1">
                <SaleTypeBadge saleType={product.saleType} />
                <Link
                  href={`/products/${product.slug}`}
                  className="block truncate font-semibold hover:underline"
                >
                  {product.name}
                </Link>
                <p className="text-xs text-mute">
                  {t('releaseAt', { time: formatDateTime(product.releaseAt!, locale) })} ·{' '}
                  {t('remindAt', { time: formatDateTime(remindAt, locale) })}
                </p>
                <Countdown
                  target={product.releaseAt!}
                  serverNow={now}
                  variant="inline"
                  className="text-sm text-ink-2"
                />
              </div>
              <ReminderButton productId={product.id} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-3xl bg-surface p-10 text-center ring-1 ring-line">
          <p className="text-sm text-mute">{t('empty')}</p>
          <ButtonLink href="/calendar" className="mt-5">
            {t('browseCalendar')}
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
