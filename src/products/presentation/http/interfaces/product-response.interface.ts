import type { Product } from '../../../domain/models/product.interface';

export type ProductResponse = Pick<
  Product,
  'id' | 'name' | 'description' | 'priceInCents' | 'status' | 'createdAt'
>;
