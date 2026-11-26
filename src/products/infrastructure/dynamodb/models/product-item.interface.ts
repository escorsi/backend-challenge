import type { Product } from '../../../domain/models/product.interface';

export interface ProductItem extends Product {
  createdAtId: string;
  nameSort: string;
  priceSort: string;
  descriptionSearch: string;
}
