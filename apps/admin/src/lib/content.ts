import 'server-only';
import { serverApi } from './api';

/** 活動可關聯的商品（上架中與草稿，依更新時間排序） */
export async function eventProductOptions(): Promise<{ id: string; label: string }[]> {
  const api = await serverApi();
  const { data } = await api.GET('/v1/admin/products', {
    params: { query: { pageSize: 100, page: 1 } },
  });
  return (data?.data ?? [])
    .filter((product) => product.status !== 'ARCHIVED')
    .map((product) => ({ id: product.id, label: `${product.name}（${product.sku}）` }));
}
