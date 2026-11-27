import type {
  CreateProductParams,
  Product,
} from '../../../domain/models/product.interface';
import type { ProductItem } from '../models/product-item.interface';

export function toProductItem(params: CreateProductParams): ProductItem {
  return {
    ...params,
    createdAtId: `${params.createdAt}#${params.id}`,
    nameSort: `${params.name.trim().toLowerCase()}#${params.id}`,
    priceSort: `${String(params.priceInCents).padStart(15, '0')}#${params.id}`,
    descriptionSearch: params.description.trim().toLowerCase(),
  };
}

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
