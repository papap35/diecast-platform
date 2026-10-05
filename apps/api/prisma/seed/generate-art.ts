/**
 * 依 catalog-data.ts 產生商品插圖與品牌徽章到 public/，產物會提交進版本控制。
 * 執行：pnpm --filter @paddock64/api art
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderCarSvg } from './car-art.js';
import { BRANDS, PRODUCTS } from './catalog-data.js';

const publicDir = fileURLToPath(new URL('../../public/', import.meta.url));
mkdirSync(`${publicDir}products`, { recursive: true });
mkdirSync(`${publicDir}brands`, { recursive: true });

const CROPS = {
  '': '0 0 1200 900',
  '-front': '560 300 640 480',
  '-rear': '0 300 640 480',
} as const;

for (const product of PRODUCTS) {
  const svg = renderCarSvg(product.art, product.sku.toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (const [suffix, viewBox] of Object.entries(CROPS)) {
    writeFileSync(
      `${publicDir}products/${product.slug}${suffix}.svg`,
      svg.replace('viewBox="0 0 1200 900"', `viewBox="${viewBox}"`),
    );
  }
}

const BRAND_COLORS = ['#4b2a7a', '#c2410c', '#b91c1c', '#0f766e', '#a16207', '#1d4ed8'];
BRANDS.forEach((brand, index) => {
  const initials = brand.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  writeFileSync(
    `${publicDir}brands/${brand.slug}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img">
  <rect width="200" height="200" rx="40" fill="${BRAND_COLORS[index % BRAND_COLORS.length]}"/>
  <circle cx="100" cy="100" r="74" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="4"/>
  <text x="100" y="122" font-family="Arial Black, Arial, sans-serif" font-size="64" font-weight="900" text-anchor="middle" fill="#ffffff" letter-spacing="2">${initials}</text>
</svg>
`,
  );
});

console.log(`已產生 ${PRODUCTS.length * 3} 張商品圖、${BRANDS.length} 個品牌徽章 → ${publicDir}`);
