import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PlusIcon } from '@/components/icons';
import { PageHeader } from '@/components/page-header';
import { BrandForm } from '@/components/taxonomy-forms';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { serverApi } from '@/lib/api';
import { can, getAdmin } from '@/lib/permissions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('brands');
  return { title: t('title') };
}

export default async function BrandsPage({ searchParams }: PageProps<'/brands'>) {
  const t = await getTranslations('brands');
  const tc = await getTranslations('common');
  const { edit } = await searchParams;
  const api = await serverApi();
  const [{ data: brands }, admin] = await Promise.all([api.GET('/v1/admin/brands'), getAdmin()]);
  const canWrite = can(admin, 'catalog:write');
  const editing = brands?.find((brand) => brand.id === edit);

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          canWrite && editing ? (
            <ButtonLink href="/brands" variant="secondary">
              <PlusIcon size={16} />
              {t('new')}
            </ButtonLink>
          ) : null
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('slug')}</th>
                <th>{t('country')}</th>
                <th className="text-right">{t('products')}</th>
                <th>{tc('status')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(brands ?? []).map((brand) => (
                <tr key={brand.id} className={brand.id === edit ? 'bg-canvas' : 'hover:bg-canvas'}>
                  <td>
                    <span className="flex items-center gap-3">
                      {brand.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- 品牌徽章 SVG
                        <img src={brand.logoUrl} alt="" className="h-8 w-8 rounded-lg" />
                      ) : null}
                      <span className="font-semibold">{brand.name}</span>
                    </span>
                  </td>
                  <td className="text-mute">{brand.slug}</td>
                  <td>{brand.country}</td>
                  <td className="text-right tabular">{brand.productCount}</td>
                  <td>
                    <Badge tone={brand.isActive ? 'ok' : 'neutral'}>
                      {brand.isActive ? t('active') : '—'}
                    </Badge>
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/brands?edit=${brand.id}`}
                      className="text-xs font-semibold text-mute hover:text-ink"
                    >
                      {tc('edit')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="lg:sticky lg:top-6 lg:self-start">
          <BrandForm brand={editing} canWrite={canWrite} />
        </div>
      </div>
    </>
  );
}
