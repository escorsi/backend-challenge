import type {
  CreateProductParams,
  Product,
} from '@/products/domain/models/product.interface';
import type { ProductItem } from '../models/product-item.interface';
import { MAX_PRODUCT_PRICE_IN_CENTS } from '@/products/domain/constants/product-pricing.constants';

const PRICE_SORT_KEY_WIDTH = String(MAX_PRODUCT_PRICE_IN_CENTS).length;

export function toProductNameAttributes(
  name: string,
): Pick<ProductItem, 'nameSort' | 'nameSearch'> {
  const normalizedName = name.trim().toLowerCase();

  return { nameSort: normalizedName, nameSearch: normalizedName };
}

export function toProductItem(params: CreateProductParams): ProductItem {
  return {
    ...params,
    ...toProductNameAttributes(params.name),
    createdAtId: `${params.createdAt}#${params.id}`,
    priceSort: `${String(params.priceInCents).padStart(
      PRICE_SORT_KEY_WIDTH,
      '0',
    )}#${params.id}`,
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
