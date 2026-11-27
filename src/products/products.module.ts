import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DynamoDBModule } from '../database/dynamodb/dynamodb.module';

import { ProductsController } from './presentation/http/products.controller';
import { SignedProductCursorCodecAdapter } from './infrastructure/security/signed-product-cursor-codec.adapter';
import { FindProductsService } from './application/use-cases/find-products/find-products.service';
import { CreateProductService } from './application/use-cases/create-product/create-product.service';
import { PRODUCTS_READER } from './application/ports/products-reader.port';
import { PRODUCTS_WRITER } from './application/ports/products-writer.port';
import { PRODUCT_CURSOR_CODEC } from './application/ports/product-cursor-codec.port';
import { RolesGuard } from '../common/guards/roles.guard';
import { RateLimitModule } from '../common/rate-limit/rate-limit.module';
import type { ProductsReaderPort } from './application/ports/products-reader.port';
import type { ProductsWriterPort } from './application/ports/products-writer.port';
import { SystemModule } from '../shared/infrastructure/system/system.module';
import { CLOCK } from '../shared/application/ports/clock.port';
import { ID_GENERATOR } from '../shared/application/ports/id-generator.port';
import type { Clock } from '../shared/application/ports/clock.port';
import type { IdGenerator } from '../shared/application/ports/id-generator.port';
import { ProductsReaderAdapter } from './infrastructure/dynamodb/products-reader.adapter';
import { ProductsWriterAdapter } from './infrastructure/dynamodb/products-writer.adapter';
import { ProductCursorManager } from './infrastructure/dynamodb/product-cursor.manager';

@Module({
  imports: [AuthModule, DynamoDBModule, RateLimitModule, SystemModule],
  controllers: [ProductsController],
  providers: [
    ProductCursorManager,
    ProductsReaderAdapter,
    ProductsWriterAdapter,
    { provide: PRODUCTS_READER, useExisting: ProductsReaderAdapter },
    { provide: PRODUCTS_WRITER, useExisting: ProductsWriterAdapter },
    SignedProductCursorCodecAdapter,
    {
      provide: PRODUCT_CURSOR_CODEC,
      useExisting: SignedProductCursorCodecAdapter,
    },
    {
      provide: FindProductsService,
      inject: [PRODUCTS_READER],
      useFactory: (reader: ProductsReaderPort) =>
        new FindProductsService(reader),
    },
    {
      provide: CreateProductService,
      inject: [PRODUCTS_WRITER, ID_GENERATOR, CLOCK],
      useFactory: (
        writer: ProductsWriterPort,
        idGenerator: IdGenerator,
        clock: Clock,
      ) => new CreateProductService(writer, idGenerator, clock),
    },
    RolesGuard,
  ],
})
export class ProductsModule {}
