import { ProductSummaryDto } from '../../catalog/dto/catalog.dto.js';

export class WishlistItemDto {
  product!: ProductSummaryDto;
  addedAt!: Date;
}

export class WishlistDto {
  data!: WishlistItemDto[];
}

/** 已加入的商品 id（前台用來標示愛心狀態） */
export class ProductIdListDto {
  ids!: string[];
}
