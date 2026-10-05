import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { updateProductAction } from '@/app/actions/catalog';
import { ArchiveButton } from '@/components/archive-button';
import { ExternalIcon } from '@/components/icons';
import { PageHeader } from '@/components/page-header';
import { ProductForm } from '@/components/product-form';
import { StockPanel } from '@/components/stock-panel';
import { AvailabilityBadge, ProductStatusBadge } from '@/components/status-badges';
import { buttonClass } from '@/components/ui/button';
import { serverApi } from '@/lib/api';
import { STOREFRONT_URL } from '@/lib/env';
import { can, getAdmin } from '@/lib/permissions';

export async function generateMetadata({ params }: PageProps<'/products/[id]'>): Promise<Metadata> {
  const t = await getTranslations('products');
  const { id } = await params;
  return { title: `${t('editTitle')} ${id.slice(0, 8)}` };
}

export default async function ProductPage({ params, searchParams }: PageProps<'/products/[id]'>) {
  const { id } = await params;
  const { created } = await searchParams;
  const t = await getTranslations('products');
  const api = await serverApi();
  const [product, brands, categories, movements, admin] = await Promise.all([
    api.GET('/v1/admin/products/{id}', { params: { path: { id } } }),
    api.GET('/v1/admin/brands'),
    api.GET('/v1/admin/categories'),
    api.GET('/v1/admin/products/{id}/stock-movements', { params: { path: { id } } }),
    getAdmin(),
  ]);
  if (!product.data) notFound();
  const p = product.data;
  const canWrite = can(admin, 'product:write');
  const name = p.translations.find((tr) => tr.locale === 'zh-TW')?.name ?? p.sku;

  return (
    <>
      <Link href="/products" className="mb-3 inline-block text-sm text-mute hover:text-ink">
        ← {t('title')}
      </Link>
      <PageHeader
        title={name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {p.sku} <ProductStatusBadge status={p.status} />{' '}
            <AvailabilityBadge availability={p.availability} />
          </span>
        }
        actions={
          <>
            <a
              href={`${STOREFRONT_URL}/zh-TW/products/${p.slug}`}
              target="_blank"
              rel="noreferrer"
              className={buttonClass('secondary')}
            >
              <ExternalIcon size={16} />
              {t('viewOnStore')}
            </a>
            {canWrite && p.status !== 'ARCHIVED' ? <ArchiveButton productId={p.id} /> : null}
          </>
        }
      />
      {created ? (
        <p className="mb-4 rounded-xl bg-ok-soft px-4 py-3 text-sm text-ok">{t('created')}</p>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <ProductForm
          action={updateProductAction.bind(null, p.id)}
          product={p}
          brands={brands.data ?? []}
          categories={categories.data ?? []}
          canWrite={canWrite}
        />
        <div className="xl:sticky xl:top-6 xl:self-start">
          <StockPanel
            productId={p.id}
            stock={p.stock}
            soldCount={p.soldCount}
            movements={movements.data ?? []}
            canWrite={canWrite}
          />
        </div>
      </div>
    </>
  );
}
