import type { FindProductsParams } from '../../domain/models/product.interface';
import type { PaginatedProducts } from '../../domain/models/product-pagination.interface';

export const PRODUCTS_READER = Symbol('PRODUCTS_READER');

export interface ProductsReaderPort {
  findAll(params: FindProductsParams): Promise<PaginatedProducts>;
}
