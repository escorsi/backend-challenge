import type { ProductSortBy } from '../../../domain/models/product.interface';

export const PRODUCT_INDEXES: Record<
  ProductSortBy,
  { indexName: string; sortKey: 'createdAtId' | 'nameSort' | 'priceSort' }
> = {
  createdAt: {
    indexName: 'status-created-at-index',
    sortKey: 'createdAtId',
  },
  name: {
    indexName: 'status-name-index',
    sortKey: 'nameSort',
  },
  price: {
    indexName: 'status-price-index',
    sortKey: 'priceSort',
  },
};
