import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['@paddock64/api-client'],
  images: {
    // 商品圖由 API（或物件儲存）提供；示範圖為 SVG，直接使用原檔不做最佳化
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  poweredByHeader: false,
};

export default withNextIntl(nextConfig);
