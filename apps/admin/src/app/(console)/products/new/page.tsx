import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { createProductAction } from '@/app/actions/catalog';
import { PageHeader } from '@/components/page-header';
import { ProductForm } from '@/components/product-form';
import { serverApi } from '@/lib/api';
import { can, getAdmin } from '@/lib/permissions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('products');
  return { title: t('new') };
}

export default async function NewProductPage() {
  const admin = await getAdmin();
  if (!can(admin, 'product:write')) redirect('/products');
  const t = await getTranslations('products');
  const api = await serverApi();
  const [brands, categories] = await Promise.all([
    api.GET('/v1/admin/brands'),
    api.GET('/v1/admin/categories'),
  ]);
  return (
    <>
      <PageHeader title={t('new')} />
      <ProductForm
        action={createProductAction}
        brands={brands.data ?? []}
        categories={categories.data ?? []}
        canWrite
      />
    </>
  );
}
