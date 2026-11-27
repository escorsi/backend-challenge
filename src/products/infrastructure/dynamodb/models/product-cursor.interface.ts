import type { QueryCommandInput } from '@aws-sdk/lib-dynamodb';

import type {
  ProductSortBy,
  SortOrder,
} from '@/products/domain/models/product.interface';

export type ProductCursorKey = NonNullable<
  QueryCommandInput['ExclusiveStartKey']
>;

export interface ProductCursor {
  version: 2;
  lastEvaluatedKey: ProductCursorKey;
  sortBy: ProductSortBy;
  sortOrder: SortOrder;
  searchTerm?: string;
}
