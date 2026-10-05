import { ProductSummaryDto } from '../../catalog/dto/catalog.dto.js';

export class ReminderDto {
  product!: ProductSummaryDto;
  /** 通知時間：開賣（符合優先購資格時為優先購開始）前 15 分鐘 */
  remindAt!: Date;
  notifiedAt!: Date | null;
}

export class ReminderListDto {
  data!: ReminderDto[];
}
