import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { BannerForm } from '@/components/content-forms';
import { PlusIcon } from '@/components/icons';
import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { BannerStateBadge } from '@/components/status-badges';
import { ButtonLink } from '@/components/ui/button';
import { serverApi } from '@/lib/api';
import { THEME_COLORS } from '@/lib/banner-themes';
import { API_BASE_URL } from '@/lib/env';
import { formatDateTime } from '@/lib/format';
import { can, getAdmin } from '@/lib/permissions';

const PLACEMENTS = ['ANNOUNCEMENT', 'HOME_PROMO'] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('banners');
  return { title: t('title') };
}

export default async function BannersPage({ searchParams }: PageProps<'/banners'>) {
  const t = await getTranslations('banners');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  if (!can(await getAdmin(), 'content:write')) return <NoAccess title={t('title')} />;

  const { edit } = await searchParams;
  const api = await serverApi();
  const { data } = await api.GET('/v1/admin/banners');
  const banners = data?.data ?? [];
  const editing = banners.find((banner) => banner.id === edit);
  const period = (from: string | null, to: string | null) =>
    from || to
      ? `${from ? formatDateTime(from, locale) : t('now')} – ${to ? formatDateTime(to, locale) : t('noEnd')}`
      : t('always');

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          editing ? (
            <ButtonLink href="/banners" variant="secondary">
              <PlusIcon size={16} />
              {t('new')}
            </ButtonLink>
          ) : null
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_26rem]">
        <div className="flex flex-col gap-5">
          {PLACEMENTS.map((placement) => {
            const items = banners.filter((banner) => banner.placement === placement);
            return (
              <section key={placement} className="card overflow-hidden">
                <div className="border-b border-line px-5 py-4">
                  <h2 className="text-sm font-semibold">{t(`placements.${placement}`)}</h2>
                  <p className="mt-0.5 text-xs text-mute">{t(`placementHints.${placement}`)}</p>
                </div>
                {items.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-mute">{tc('noData')}</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {items.map((banner) => (
                      <li key={banner.id}>
                        <Link
                          href={`/banners?edit=${banner.id}`}
                          className={`flex items-center gap-4 px-5 py-3 hover:bg-canvas ${banner.id === edit ? 'bg-canvas' : ''}`}
                        >
                          <span
                            className="h-9 w-9 shrink-0 rounded-lg"
                            style={{ backgroundColor: THEME_COLORS[banner.theme] }}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                              {banner.title}
                            </span>
                            <span className="block text-xs text-mute tabular">
                              {period(banner.startsAt, banner.endsAt)} ·{' '}
                              {t('sortOrderShort', { order: banner.sortOrder })}
                            </span>
                          </span>
                          <BannerStateBadge state={banner.state} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
        <div className="lg:sticky lg:top-6 lg:self-start">
          <BannerForm
            key={editing?.updatedAt ?? 'new'}
            banner={editing}
            apiBaseUrl={API_BASE_URL}
          />
        </div>
      </div>
    </>
  );
}
