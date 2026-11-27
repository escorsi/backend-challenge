import type { Product } from '@/products/domain/models/product.interface';

export interface ProductItem extends Product {
  createdAtId: string;
  nameSort: string;
  nameSearch: string;
  priceSort: string;
  descriptionSearch: string;
}
