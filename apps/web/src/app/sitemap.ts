import { createApiClient } from '@paddock64/api-client';
import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { API_BASE_URL, SITE_URL } from '@/lib/env';

// 每次請求時產生：建置時不需要連得到 API，商品、活動也一定是最新的
export const dynamic = 'force-dynamic';

const STATIC_PATHS = ['', '/products', '/drops', '/calendar', '/brands', '/events'];
const PAGE_SIZE = 100;

/** 一個網址一筆，另外列出各語系版本（hreflang） */
function entry(path: string, lastModified?: string): MetadataRoute.Sitemap[number] {
  return {
    url: `${SITE_URL}/${routing.defaultLocale}${path}`,
    ...(lastModified ? { lastModified } : {}),
    alternates: {
      languages: Object.fromEntries(routing.locales.map((l) => [l, `${SITE_URL}/${l}${path}`])),
    },
  };
}

async function productPaths(api: ReturnType<typeof createApiClient>): Promise<string[]> {
  const paths: string[] = [];
  for (let page = 1; ; page += 1) {
    const { data } = await api.GET('/v1/products', {
      params: { query: { page, pageSize: PAGE_SIZE } },
    });
    if (!data) break;
    paths.push(...data.data.map((product) => `/products/${product.slug}`));
    if (page >= data.meta.totalPages) break;
  }
  return paths;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const api = createApiClient({ baseUrl: API_BASE_URL });
  // API 暫時無法連線時仍回傳固定頁面，不讓整份 sitemap 失敗
  const [products, brands, events] = await Promise.all([
    productPaths(api).catch(() => []),
    api
      .GET('/v1/brands')
      .then(({ data }) => (data ?? []).map((brand) => `/brands/${brand.slug}`))
      .catch(() => []),
    api
      .GET('/v1/events', { params: { query: { pageSize: PAGE_SIZE } } })
      .then(({ data }) => (data?.data ?? []).map((event) => `/events/${event.slug}`))
      .catch(() => []),
  ]);
  return [...STATIC_PATHS, ...products, ...brands, ...events].map((path) => entry(path));
}
