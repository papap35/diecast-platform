import type { Schemas } from '@paddock64/api-client';

type Coupon = Pick<Schemas['AdminCouponDto'], 'type' | 'value' | 'maxDiscount'>;

/**
 * 優惠內容的翻譯參數：中文以「折」表示（折扣 15% → 85 折、10% → 9 折），英文以百分比表示。
 * 搭配 coupons.benefit.{type} 訊息使用。
 */
export function benefitParams(coupon: Coupon) {
  const pay = 100 - coupon.value;
  return {
    amount: coupon.value.toLocaleString('en-US'),
    percent: coupon.value,
    zhRate: pay % 10 === 0 ? String(pay / 10) : String(pay),
    cap: coupon.maxDiscount ? coupon.maxDiscount.toLocaleString('en-US') : '',
    hasCap: coupon.maxDiscount ? 'yes' : 'no',
  };
}
