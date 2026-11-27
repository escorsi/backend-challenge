import type { ProductStatus } from '../enums/product-status.enum';
export { ProductStatus } from '../enums/product-status.enum';

export interface Product {
  id: string;
  name: string;
  description: string;
  priceInCents: number;
  status: ProductStatus;
  createdAt: string;
}

export type CreateProductParams = Product;

export type CreateProductInput = Pick<
  Product,
  'name' | 'description' | 'priceInCents'
> & { status: ProductStatus };

export type ProductSortBy = 'createdAt' | 'name' | 'price';

export type SortOrder = 'asc' | 'desc';

export interface FindProductsParams {
  pageSize: number;
  cursor?: string;
  sortBy: ProductSortBy;
  sortOrder: SortOrder;
  searchTerm?: string;
}
