interface MockPagePayment {
  merchantTradeNo: string;
  amount: number;
  status: string;
  order: { orderNo: string; paymentDeadline: Date | null };
}

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** 模擬第三方金流的付款頁：沒有任何真實扣款，只用來走完付款流程 */
export function renderMockPaymentPage(payment: MockPagePayment): string {
  const done = payment.status !== 'PENDING';
  const amount = payment.amount.toLocaleString('zh-TW');
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>模擬金流 Mock Payment</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; font-family: system-ui, -apple-system, "Noto Sans TC", sans-serif; background: #f2f1ee; color: #18181b; display: grid; place-items: center; min-height: 100vh; }
  .card { width: min(420px, calc(100vw - 32px)); background: #fff; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,.08); overflow: hidden; }
  .banner { background: #fef3c7; color: #92400e; font-size: 13px; padding: 10px 20px; }
  .body { padding: 24px 20px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .muted { color: #71717a; font-size: 13px; }
  .amount { font-size: 34px; font-weight: 800; margin: 20px 0; letter-spacing: -.02em; }
  .row { display: flex; justify-content: space-between; font-size: 14px; padding: 8px 0; border-top: 1px solid #f4f4f5; }
  form { display: grid; gap: 10px; margin-top: 20px; }
  button { font: inherit; font-weight: 600; border: 0; border-radius: 10px; padding: 14px; cursor: pointer; }
  .pay { background: #18181b; color: #fff; }
  .fail { background: #f4f4f5; color: #b91c1c; }
  @media (prefers-color-scheme: dark) {
    body { background: #0c0c0e; color: #f4f4f5; }
    .card { background: #18181b; }
    .row { border-color: #27272a; }
    .pay { background: #f4f4f5; color: #18181b; }
    .fail { background: #27272a; }
  }
</style>
</head>
<body>
  <main class="card">
    <div class="banner">這是模擬金流頁，不會實際扣款 · Demo gateway — no real charge</div>
    <div class="body">
      <h1>Paddock 64 付款</h1>
      <div class="muted">訂單 ${escape(payment.order.orderNo)}</div>
      <div class="amount">NT$ ${amount}</div>
      <div class="row"><span class="muted">交易編號</span><span>${escape(payment.merchantTradeNo)}</span></div>
      ${
        payment.order.paymentDeadline
          ? `<div class="row"><span class="muted">付款期限</span><span>${payment.order.paymentDeadline.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</span></div>`
          : ''
      }
      ${
        done
          ? `<p class="muted">此筆付款已處理（${escape(payment.status)}），可以關閉此頁。</p>`
          : `<form method="post" action="/v1/payments/mock/${escape(payment.merchantTradeNo)}/complete">
        <button class="pay" name="result" value="success">模擬付款成功 · Pay</button>
        <button class="fail" name="result" value="failure">模擬付款失敗 · Decline</button>
      </form>`
      }
    </div>
  </main>
</body>
</html>`;
}
