import type { FindProductsParams } from '@/products/domain/models/product.interface';
import type { ProductsReaderPort } from '@/products/application/ports/products-reader.port';
import type { PaginatedProducts } from '@/products/domain/models/product-pagination.interface';

export class FindProductsService {
  constructor(private readonly productsReader: ProductsReaderPort) {}

  execute(params: FindProductsParams): Promise<PaginatedProducts> {
    return this.productsReader.findAll(params);
  }
}
