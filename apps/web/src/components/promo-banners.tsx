import type { Schemas } from '@paddock64/api-client';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { cn } from '@/lib/cn';
import { BannerLink } from './banner-link';
import { ArrowRightIcon } from './icons';

type Banner = Schemas['BannerDto'];

export const BANNER_THEMES: Record<Banner['theme'], string> = {
  INK: 'bg-[#16161a]',
  RED: 'bg-[#a91c15]',
  NAVY: 'bg-[#1d3f6e]',
  GOLD: 'bg-[#7a5a12]',
};

const COLUMNS = ['', 'md:grid-cols-1', 'md:grid-cols-2', 'md:grid-cols-3'];

/** 首頁活動橫幅（後台「首頁橫幅與公告」管理，最多顯示三則） */
export async function PromoBanners({ banners }: { banners: Banner[] }) {
  const t = await getTranslations('home');
  const shown = banners.slice(0, 3);
  if (shown.length === 0) return null;

  return (
    <section
      aria-label={t('promoLabel')}
      className={cn('container-page mt-6 grid gap-3', COLUMNS[shown.length])}
    >
      {shown.map((banner) => {
        const body = (
          <>
            <div className="relative z-10 max-w-[56%] space-y-2">
              <h2 className="display text-xl leading-tight sm:text-2xl">{banner.title}</h2>
              {banner.subtitle ? <p className="text-sm text-white/75">{banner.subtitle}</p> : null}
            </div>
            {banner.ctaLabel ? (
              <span className="relative z-10 inline-flex items-center gap-1.5 text-sm font-semibold">
                {banner.ctaLabel}
                <ArrowRightIcon
                  size={16}
                  className="transition-transform group-hover:translate-x-1"
                />
              </span>
            ) : null}
            {banner.imageUrl ? (
              <div className="absolute -right-5 -bottom-6 w-40 -rotate-6 overflow-hidden rounded-xl shadow-lift ring-4 ring-white/15 transition-transform duration-300 group-hover:rotate-0 group-hover:scale-105 sm:w-44">
                <Image
                  src={banner.imageUrl}
                  alt=""
                  width={240}
                  height={180}
                  unoptimized
                  className="block h-auto w-full"
                />
              </div>
            ) : null}
          </>
        );
        const className = cn(
          'group relative isolate flex min-h-52 flex-col justify-between gap-6 overflow-hidden rounded-3xl p-6 text-white',
          BANNER_THEMES[banner.theme],
        );
        return banner.linkUrl ? (
          <BannerLink key={banner.id} href={banner.linkUrl} className={className}>
            {body}
          </BannerLink>
        ) : (
          <div key={banner.id} className={className}>
            {body}
          </div>
        );
      })}
    </section>
  );
}
