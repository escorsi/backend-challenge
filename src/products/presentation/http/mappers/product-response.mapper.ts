import type { Product } from '../../../domain/models/product.interface';
import type { ProductResponse } from '../interfaces/product-response.interface';

export function toProductResponse(product: Product): ProductResponse {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    priceInCents: product.priceInCents,
    status: product.status,
    createdAt: product.createdAt,
  };
}
