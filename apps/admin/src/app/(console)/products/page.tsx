import type { paths } from '@paddock64/api-client';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { PlusIcon } from '@/components/icons';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { AvailabilityBadge, ProductStatusBadge } from '@/components/status-badges';
import { ButtonLink, buttonClass } from '@/components/ui/button';
import { Checkbox, Input, Select } from '@/components/ui/field';
import { serverApi } from '@/lib/api';
import { formatDateTime, formatPrice } from '@/lib/format';
import { can, getAdmin } from '@/lib/permissions';

type Query = NonNullable<paths['/v1/admin/products']['get']['parameters']['query']>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('products');
  return { title: t('title') };
}

export default async function ProductsPage({ searchParams }: PageProps<'/products'>) {
  const t = await getTranslations('products');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const raw = await searchParams;
  const params = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  ) as Record<string, string | undefined>;

  const query: Query = {
    page: Number(params.page) || 1,
    pageSize: 20,
    q: params.q || undefined,
    status: (params.status || undefined) as Query['status'],
    saleType: (params.saleType || undefined) as Query['saleType'],
    brandId: params.brandId || undefined,
    lowStock: params.lowStock === 'true' ? 'true' : undefined,
  };
  const api = await serverApi();
  const [list, brands, admin] = await Promise.all([
    api.GET('/v1/admin/products', { params: { query } }),
    api.GET('/v1/admin/brands'),
    getAdmin(),
  ]);
  const data = list.data;

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          can(admin, 'product:write') ? (
            <ButtonLink href="/products/new">
              <PlusIcon size={16} />
              {t('new')}
            </ButtonLink>
          ) : null
        }
      />

      <form method="get" className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <Input
          name="q"
          defaultValue={params.q}
          placeholder={t('searchPlaceholder')}
          className="w-64"
        />
        <Select
          name="status"
          defaultValue={params.status ?? ''}
          className="w-36"
          aria-label={tc('status')}
        >
          <option value="">
            {tc('status')}：{tc('all')}
          </option>
          {(['DRAFT', 'ACTIVE', 'ARCHIVED'] as const).map((s) => (
            <option key={s} value={s}>
              {t(`statuses.${s}`)}
            </option>
          ))}
        </Select>
        <Select
          name="saleType"
          defaultValue={params.saleType ?? ''}
          className="w-40"
          aria-label={t('saleType')}
        >
          <option value="">
            {t('saleType')}：{tc('all')}
          </option>
          {(['REGULAR', 'PRE_ORDER', 'LIMITED'] as const).map((s) => (
            <option key={s} value={s}>
              {t(`saleTypes.${s}`)}
            </option>
          ))}
        </Select>
        <Select
          name="brandId"
          defaultValue={params.brandId ?? ''}
          className="w-48"
          aria-label={t('brand')}
        >
          <option value="">
            {t('brand')}：{tc('all')}
          </option>
          {(brands.data ?? []).map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </Select>
        <Checkbox
          name="lowStock"
          value="true"
          defaultChecked={params.lowStock === 'true'}
          label={t('lowStockOnly')}
        />
        <button type="submit" className={buttonClass('primary', 'md')}>
          {tc('search')}
        </button>
        <Link href="/products" className="text-sm text-mute hover:text-ink">
          {tc('reset')}
        </Link>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('brand')}</th>
                <th>{t('saleType')}</th>
                <th className="text-right">{t('price')}</th>
                <th className="text-right">{t('stock')}</th>
                <th>{tc('status')}</th>
                <th>{t('availability')}</th>
                <th>{tc('updatedAt')}</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((product) => (
                <tr key={product.id} className="hover:bg-canvas">
                  <td>
                    <Link href={`/products/${product.id}`} className="flex items-center gap-3">
                      <span className="h-10 w-14 shrink-0 overflow-hidden rounded-md bg-canvas ring-1 ring-line">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- 縮圖直接使用 API 提供的 SVG
                          <img
                            src={product.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block max-w-xs truncate font-semibold hover:underline">
                          {product.name}
                        </span>
                        <span className="text-xs text-mute">
                          {product.sku} · {product.scale}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="text-ink-2">{product.brandName}</td>
                  <td className="text-ink-2">{t(`saleTypes.${product.saleType}`)}</td>
                  <td className="text-right tabular">{formatPrice(product.price)}</td>
                  <td
                    className={`text-right font-semibold tabular ${product.stock <= 5 ? 'text-warn' : ''}`}
                  >
                    {product.stock}
                  </td>
                  <td>
                    <ProductStatusBadge status={product.status} />
                  </td>
                  <td>
                    <AvailabilityBadge availability={product.availability} />
                  </td>
                  <td className="whitespace-nowrap text-xs text-mute tabular">
                    {formatDateTime(product.updatedAt, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.data.length === 0 ? (
            <p className="p-8 text-center text-sm text-mute">{tc('noData')}</p>
          ) : null}
        </div>
        {data ? (
          <Pagination
            basePath="/products"
            params={params}
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            total={data.meta.total}
          />
        ) : null}
      </div>
    </>
  );
}
