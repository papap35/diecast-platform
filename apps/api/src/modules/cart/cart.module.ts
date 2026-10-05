import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';

@Module({
  imports: [CatalogModule],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
