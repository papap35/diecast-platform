import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/env';

/** 會員中心、購物車、結帳等個人化頁面不需要被索引 */
const PRIVATE = ['account', 'cart', 'checkout', 'login', 'register', 'unsubscribe'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: PRIVATE.map((path) => `/*/${path}`) },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
