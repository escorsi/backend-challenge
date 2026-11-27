import type { Product } from './product.interface';

export interface ProductPagination {
  pageSize: number;
  nextCursor: string | null;
  hasNextPage: boolean;
}

export interface PaginatedProducts {
  items: Product[];
  pagination: ProductPagination;
}
