import type { Product } from '@/products/domain/models/product.interface';

export type ProductResponse = Pick<
  Product,
  'id' | 'name' | 'description' | 'priceInCents' | 'status' | 'createdAt'
>;
