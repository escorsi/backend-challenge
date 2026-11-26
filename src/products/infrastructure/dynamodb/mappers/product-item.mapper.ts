import type {
  Product,
} from '../../../domain/models/product.interface';
import type { ProductItem } from '../models/product-item.interface';

export function toProduct(item: ProductItem): Product {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    priceInCents: item.priceInCents,
    status: item.status,
    createdAt: item.createdAt,
  };
}
