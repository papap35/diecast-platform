import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PlusIcon } from '@/components/icons';
import { PageHeader } from '@/components/page-header';
import { CategoryForm } from '@/components/taxonomy-forms';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { serverApi } from '@/lib/api';
import { can, getAdmin } from '@/lib/permissions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('categories');
  return { title: t('title') };
}

export default async function CategoriesPage({ searchParams }: PageProps<'/categories'>) {
  const t = await getTranslations('categories');
  const tc = await getTranslations('common');
  const { edit } = await searchParams;
  const api = await serverApi();
  const [{ data: categories = [] }, admin] = await Promise.all([
    api.GET('/v1/admin/categories'),
    getAdmin(),
  ]);
  const canWrite = can(admin, 'catalog:write');
  const roots = categories.filter((c) => !c.parentId);
  const editing = categories.find((c) => c.id === edit);
  const name = (c: (typeof categories)[number]) =>
    c.translations.find((tr) => tr.locale === 'zh-TW')?.name ?? c.slug;
  const rows = roots.flatMap((root) => [
    { category: root, depth: 0 },
    ...categories
      .filter((c) => c.parentId === root.id)
      .map((child) => ({ category: child, depth: 1 })),
  ]);

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          canWrite && editing ? (
            <ButtonLink href="/categories" variant="secondary">
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
                <th className="text-right">{t('products')}</th>
                <th>{tc('status')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ category, depth }) => (
                <tr
                  key={category.id}
                  className={category.id === edit ? 'bg-canvas' : 'hover:bg-canvas'}
                >
                  <td className={depth ? 'pl-10 text-ink-2' : 'font-semibold'}>
                    {depth ? '└ ' : ''}
                    {name(category)}
                    <span className="ml-2 text-xs font-normal text-faint">
                      {category.translations
                        .filter((tr) => tr.locale !== 'zh-TW')
                        .map((tr) => tr.name)
                        .join(' / ')}
                    </span>
                  </td>
                  <td className="text-mute">{category.slug}</td>
                  <td className="text-right tabular">{category.productCount}</td>
                  <td>
                    <Badge tone={category.isActive ? 'ok' : 'neutral'}>
                      {category.isActive ? t('active') : '—'}
                    </Badge>
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/categories?edit=${category.id}`}
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
          <CategoryForm category={editing} roots={roots} canWrite={canWrite} />
        </div>
      </div>
    </>
  );
}
