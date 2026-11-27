import type {
  CreateProductParams,
  Product,
} from '@/products/domain/models/product.interface';

export const PRODUCTS_WRITER = Symbol('PRODUCTS_WRITER');

export interface ProductsWriterPort {
  create(params: CreateProductParams): Promise<Product>;
}
