import type { FindProductsParams } from '../../../domain/models/product.interface';
import type { ProductsReaderPort } from '../../ports/products-reader.port';
import type { PaginatedProducts } from '../../../domain/models/product-pagination.interface';

export class FindProductsService {
  constructor(private readonly productsReader: ProductsReaderPort) {}

  execute(params: FindProductsParams): Promise<PaginatedProducts> {
    return this.productsReader.findAll(params);
  }
}
