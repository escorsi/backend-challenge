import type { FindProductsParams } from '@/products/domain/models/product.interface';
import type { PaginatedProducts } from '@/products/domain/models/product-pagination.interface';

export const PRODUCTS_READER = Symbol('PRODUCTS_READER');

export interface ProductsReaderPort {
  findAll(params: FindProductsParams): Promise<PaginatedProducts>;
}
