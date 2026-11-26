import type { QueryCommandInput } from '@aws-sdk/lib-dynamodb';

import type {
  ProductSortBy,
  SortOrder,
} from '../../../domain/models/product.interface';

export type ProductCursorKey = NonNullable<
  QueryCommandInput['ExclusiveStartKey']
>;

export interface ProductCursor {
  lastEvaluatedKey: ProductCursorKey;
  sortBy: ProductSortBy;
  sortOrder: SortOrder;
  pageSize: number;
  searchTerm?: string;
}
