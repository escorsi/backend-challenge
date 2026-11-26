import { z } from 'zod';

import {
  PRODUCTS_QUERY_DEFAULTS,
  PRODUCTS_QUERY_LIMIT,
  PRODUCTS_SEARCH_LENGTH,
  PRODUCTS_SORT_FIELDS,
  PRODUCTS_SORT_ORDERS,
} from '../../../infrastructure/dynamodb/constants/products-query.constants';

export const productsQuerySchema = z.object({
  pageSize: z.coerce
    .number()
    .int()
    .min(PRODUCTS_QUERY_LIMIT.MIN)
    .max(PRODUCTS_QUERY_LIMIT.MAX)
    .default(PRODUCTS_QUERY_LIMIT.DEFAULT),

  cursor: z.string().min(1).optional(),

  sortBy: z.enum(PRODUCTS_SORT_FIELDS).default(PRODUCTS_QUERY_DEFAULTS.sortBy),

  sortOrder: z
    .enum(PRODUCTS_SORT_ORDERS)
    .default(PRODUCTS_QUERY_DEFAULTS.sortOrder),

  search: z
    .string()
    .trim()
    .min(PRODUCTS_SEARCH_LENGTH.MIN)
    .max(PRODUCTS_SEARCH_LENGTH.MAX)
    .optional(),
});

export type ProductsQueryDto = z.infer<typeof productsQuerySchema>;
