import type { Schemas } from '@paddock64/api-client';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { formatDateTime } from '@/lib/format';
import { AvailabilityBadge, SaleTypeBadge } from './availability-badge';
import { Price } from './price';

type Product = Schemas['ProductSummaryDto'];

export function ProductCard({
  product,
  priority = false,
}: {
  product: Product;
  priority?: boolean;
}) {
  const t = useTranslations('product');
  const locale = useLocale();
  const upcoming = product.availability === 'COMING_SOON' && product.releaseAt;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-paper">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            unoptimized
            priority={priority}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : null}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <SaleTypeBadge saleType={product.saleType} />
          {product.compareAtPrice && product.compareAtPrice > product.price ? (
            <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-white">
              -{Math.round((1 - product.price / product.compareAtPrice) * 100)}%
            </span>
          ) : null}
        </div>
        {product.availability === 'SOLD_OUT' ? (
          <div className="absolute inset-0 bg-white/40 backdrop-grayscale" aria-hidden />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-semibold tracking-wide text-mute uppercase">
            {product.brand.name}
          </span>
          <span className="shrink-0 text-xs text-faint">{product.scale}</span>
        </div>
        <h3 className="line-clamp-2 min-h-10 text-sm leading-5 font-semibold text-ink">
          {product.name}
        </h3>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <Price price={product.price} compareAtPrice={product.compareAtPrice} />
          <AvailabilityBadge availability={product.availability} remaining={product.remaining} />
        </div>
        {upcoming ? (
          <p className="text-xs text-mute">
            {t('releaseAt')}・{formatDateTime(product.releaseAt!, locale)}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export function ProductGrid({
  products,
  priorityCount = 0,
}: {
  products: Product[];
  priorityCount?: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} priority={index < priorityCount} />
      ))}
    </div>
  );
}
