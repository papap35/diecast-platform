import { Module } from '@nestjs/common';
import { AdminProductsController, AdminTaxonomyController } from './admin-catalog.controller.js';
import { AdminProductsService } from './admin-products.service.js';
import { AdminTaxonomyService } from './admin-taxonomy.service.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';

@Module({
  controllers: [CatalogController, AdminProductsController, AdminTaxonomyController],
  providers: [CatalogService, AdminProductsService, AdminTaxonomyService],
  exports: [CatalogService],
})
export class CatalogModule {}
