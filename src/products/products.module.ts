import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DynamoDBModule } from '../database/dynamodb/dynamodb.module';

import { ProductsController } from './presentation/http/products.controller';
import { SignedProductCursorCodecAdapter } from './infrastructure/security/signed-product-cursor-codec.adapter';
import { FindProductsService } from './application/use-cases/find-products/find-products.service';
import { PRODUCTS_READER } from './application/ports/products-reader.port';
import { PRODUCT_CURSOR_CODEC } from './application/ports/product-cursor-codec.port';
import type { ProductsReaderPort } from './application/ports/products-reader.port';
import { ProductsReaderAdapter } from './infrastructure/dynamodb/products-reader.adapter';
import { ProductCursorManager } from './infrastructure/dynamodb/product-cursor.manager';


@Module({
  imports: [AuthModule, DynamoDBModule],
  controllers: [ProductsController],
  providers: [
    ProductCursorManager,
    ProductsReaderAdapter,
    { provide: PRODUCTS_READER, useExisting: ProductsReaderAdapter },
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
  ],
})
export class ProductsModule {}
