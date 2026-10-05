import type { paths } from '@paddock64/api-client';
import { getTranslations } from 'next-intl/server';
import { getPathname, Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { serverApi } from '@/lib/api';
import { AutoSubmitSelect } from './auto-submit-select';
import { CloseIcon } from './icons';
import { ProductGrid } from './product-card';
import { buttonClass } from './ui/button';
import { Select } from './ui/field';

type ProductQuery = NonNullable<paths['/v1/products']['get']['parameters']['query']>;
type SearchParams = Record<string, string | string[] | undefined>;

const SORTS = ['newest', 'featured', 'release', 'price_asc', 'price_desc'] as const;
const AVAILABILITIES = ['available', 'upcoming', 'preorder', 'sold_out'] as const;
const SALE_TYPES = ['REGULAR', 'PRE_ORDER', 'LIMITED'] as const;
const FILTER_KEYS = ['q', 'brand', 'category', 'scale', 'saleType', 'availability'] as const;
const PAGE_SIZE = 24;

function one(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.trim() ? v.trim() : undefined;
}

function pick<T extends readonly string[]>(
  value: string | undefined,
  allowed: T,
): T[number] | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T[number]) : undefined;
}

export async function ProductListing({
  locale,
  searchParams,
  title,
  fixed = {},
}: {
  locale: AppLocale;
  searchParams: SearchParams;
  title?: string;
  /** 固定條件（例如限量發售頁固定 saleType=LIMITED），不顯示在篩選中 */
  fixed?: Partial<ProductQuery>;
}) {
  const t = await getTranslations('listing');
  const params = Object.fromEntries(
    FILTER_KEYS.map((key) => [key, one(searchParams[key])]),
  ) as Record<(typeof FILTER_KEYS)[number], string | undefined>;
  const sort = pick(one(searchParams.sort), SORTS) ?? (fixed.saleType ? 'release' : 'newest');
  const page = Math.max(1, Number(one(searchParams.page)) || 1);

  const query: ProductQuery = {
    locale,
    q: params.q,
    brand: params.brand,
    category: params.category,
    scale: params.scale,
    saleType: pick(params.saleType, SALE_TYPES),
    availability: pick(params.availability, AVAILABILITIES),
    sort,
    page,
    pageSize: PAGE_SIZE,
    ...fixed,
  };

  const api = await serverApi(locale);
  const [products, brands, categories, scales] = await Promise.all([
    api.GET('/v1/products', { params: { query } }),
    api.GET('/v1/brands', { params: { query: { locale } } }),
    api.GET('/v1/categories', { params: { query: { locale } } }),
    api.GET('/v1/scales'),
  ]);

  const list = products.data;
  const action = getPathname({
    href: fixed.saleType === 'LIMITED' ? '/drops' : '/products',
    locale,
  });
  const heading = params.q ? t('searchResults', { q: params.q }) : (title ?? t('title'));

  const brandName = new Map((brands.data ?? []).map((b) => [b.slug, b.name]));
  const categoryName = new Map(
    (categories.data ?? []).flatMap((c) => [
      [c.slug, c.name] as const,
      ...c.children.map((k) => [k.slug, k.name] as const),
    ]),
  );
  const chips = FILTER_KEYS.filter((key) => params[key] && !(key in fixed)).map((key) => {
    const value = params[key]!;
    const label =
      key === 'brand'
        ? brandName.get(value)
        : key === 'category'
          ? categoryName.get(value)
          : key === 'availability'
            ? t(`availabilities.${value}` as never)
            : key === 'saleType'
              ? t(`saleTypes.${value}` as never)
              : value;
    const rest = new URLSearchParams();
    for (const other of FILTER_KEYS)
      if (other !== key && params[other]) rest.set(other, params[other]!);
    if (sort !== 'newest') rest.set('sort', sort);
    const qs = rest.toString();
    return { key, label: label ?? value, href: qs ? `${action}?${qs}` : action };
  });

  const filters = (
    <form action={action} method="get" className="flex flex-col gap-5">
      {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
      <FilterSelect
        name="brand"
        label={t('brand')}
        value={params.brand}
        anyLabel={t('any')}
        options={(brands.data ?? []).map((b) => ({
          value: b.slug,
          label: `${b.name} (${b.productCount})`,
        }))}
      />
      <FilterSelect
        name="category"
        label={t('category')}
        value={params.category}
        anyLabel={t('any')}
        options={(categories.data ?? []).flatMap((c) => [
          { value: c.slug, label: `${c.name} (${c.productCount})` },
          ...c.children.map((k) => ({ value: k.slug, label: `　${k.name} (${k.productCount})` })),
        ])}
      />
      <FilterSelect
        name="scale"
        label={t('scale')}
        value={params.scale}
        anyLabel={t('any')}
        options={(scales.data ?? []).map((s) => ({
          value: s.scale,
          label: `${s.scale} (${s.productCount})`,
        }))}
      />
      {'saleType' in fixed ? null : (
        <FilterSelect
          name="saleType"
          label={t('saleType')}
          value={params.saleType}
          anyLabel={t('any')}
          options={SALE_TYPES.map((value) => ({ value, label: t(`saleTypes.${value}`) }))}
        />
      )}
      <FilterSelect
        name="availability"
        label={t('availability')}
        value={params.availability}
        anyLabel={t('any')}
        options={AVAILABILITIES.map((value) => ({ value, label: t(`availabilities.${value}`) }))}
      />
      <input type="hidden" name="sort" value={sort} />
      <button type="submit" className={buttonClass('primary', 'md', 'w-full')}>
        {t('apply')}
      </button>
    </form>
  );

  const totalPages = list?.meta.totalPages ?? 1;
  const pageHref = (target: number) => {
    const qs = new URLSearchParams();
    for (const key of FILTER_KEYS) if (params[key]) qs.set(key, params[key]!);
    if (sort !== 'newest') qs.set('sort', sort);
    if (target > 1) qs.set('page', String(target));
    const s = qs.toString();
    return s ? `${action}?${s}` : action;
  };

  return (
    <div className="container-page py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl sm:text-4xl">{heading}</h1>
          <p className="mt-1 text-sm text-mute">{t('results', { count: list?.meta.total ?? 0 })}</p>
        </div>
        <form action={action} method="get" className="flex items-center gap-2">
          {FILTER_KEYS.map((key) =>
            params[key] ? <input key={key} type="hidden" name={key} value={params[key]} /> : null,
          )}
          <label htmlFor="sort" className="text-sm text-mute">
            {t('sort')}
          </label>
          <AutoSubmitSelect id="sort" name="sort" defaultValue={sort} className="h-10 w-44">
            {SORTS.map((value) => (
              <option key={value} value={value}>
                {t(`sorts.${value}`)}
              </option>
            ))}
          </AutoSubmitSelect>
          <noscript>
            <button type="submit" className={buttonClass('secondary', 'sm')}>
              {t('apply')}
            </button>
          </noscript>
        </form>
      </div>

      {chips.length ? (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <a
              key={chip.key}
              href={chip.href}
              className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white"
            >
              {chip.label}
              <CloseIcon size={14} />
            </a>
          ))}
          <a href={action} className="text-xs font-semibold text-mute underline underline-offset-4">
            {t('clearFilters')}
          </a>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[15rem_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl bg-surface p-5 ring-1 ring-line">
            <p className="eyebrow mb-4">{t('filters')}</p>
            {filters}
          </div>
        </aside>
        <details className="rounded-2xl bg-surface ring-1 ring-line lg:hidden">
          <summary className="cursor-pointer list-none px-5 py-3 text-sm font-semibold">
            {t('filters')}
          </summary>
          <div className="border-t border-line p-5">{filters}</div>
        </details>

        <div>
          {list && list.data.length > 0 ? (
            <ProductGrid products={list.data} priorityCount={4} />
          ) : (
            <div className="rounded-2xl bg-surface p-12 text-center ring-1 ring-line">
              <p className="font-semibold">{t('empty')}</p>
              <p className="mt-1 text-sm text-mute">{t('emptyHint')}</p>
              <Link href="/products" className={buttonClass('secondary', 'md', 'mt-5')}>
                {t('clearFilters')}
              </Link>
            </div>
          )}

          {totalPages > 1 ? (
            <nav
              className="mt-10 flex items-center justify-center gap-3 text-sm"
              aria-label="pagination"
            >
              {page > 1 ? (
                <a href={pageHref(page - 1)} className={buttonClass('secondary', 'sm')}>
                  {t('prev')}
                </a>
              ) : null}
              <span className="text-mute">{t('page', { page, total: totalPages })}</span>
              {page < totalPages ? (
                <a href={pageHref(page + 1)} className={buttonClass('secondary', 'sm')}>
                  {t('next')}
                </a>
              ) : null}
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  name,
  label,
  value,
  options,
  anyLabel,
}: {
  name: string;
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  anyLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`filter-${name}`} className="text-xs font-semibold text-mute">
        {label}
      </label>
      <Select id={`filter-${name}`} name={name} defaultValue={value ?? ''} className="h-10">
        <option value="">{anyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
