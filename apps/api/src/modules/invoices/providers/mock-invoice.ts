import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { randomDigits } from '../../../common/security/random.js';
import { taipeiDateStamp } from '../../orders/order-number.js';
import type { FoundInvoice, InvoiceProvider, IssuedInvoice } from '../invoice-provider.js';

const TRACK_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** 模擬電子發票：產生格式正確的假發票號碼（2 碼字軌 + 8 碼數字）與隨機碼，不會實際開立 */
@Injectable()
export class MockInvoiceProvider implements InvoiceProvider {
  readonly provider = 'MOCK' as const;

  async issue(): Promise<IssuedInvoice> {
    const track = Array.from({ length: 2 }, () => TRACK_LETTERS[randomInt(TRACK_LETTERS.length)]);
    return {
      invoiceNo: `${track.join('')}${randomDigits(8)}`,
      invoiceDate: new Date(),
      randomNumber: randomDigits(4),
      raw: { simulated: true },
    };
  }

  async find(): Promise<FoundInvoice | null> {
    return null;
  }

  async void() {
    return { simulated: true };
  }

  async allowance() {
    return { allowanceNo: `20${taipeiDateStamp()}${randomDigits(8)}`, raw: { simulated: true } };
  }
}
