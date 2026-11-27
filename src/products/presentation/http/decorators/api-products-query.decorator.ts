import { applyDecorators } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';

import {
  PRODUCTS_QUERY_DEFAULTS,
  PRODUCTS_QUERY_LIMIT,
  PRODUCTS_SEARCH_LENGTH,
  PRODUCTS_SORT_FIELDS,
  PRODUCTS_SORT_ORDERS,
} from '../constants/products-query.constants';

export function ApiProductsQuery() {
  return applyDecorators(
    ApiQuery({
      name: 'pageSize',
      required: false,
      description: 'Number of products per page.',
      example: PRODUCTS_QUERY_LIMIT.DEFAULT,
      schema: {
        type: 'integer',
        minimum: PRODUCTS_QUERY_LIMIT.MIN,
        maximum: PRODUCTS_QUERY_LIMIT.MAX,
        default: PRODUCTS_QUERY_LIMIT.DEFAULT,
      },
    }),

    ApiQuery({
      name: 'cursor',
      required: false,
      type: String,
      description:
        'Opaque cursor returned by the previous page. Omit it when requesting the first page.',
      example: 'eyJ2IjoxLCJzb3J0QnkiOi...',
    }),

    ApiQuery({
      name: 'sortBy',
      required: false,
      description: 'Field used to sort products.',
      schema: {
        type: 'string',
        enum: [...PRODUCTS_SORT_FIELDS],
        default: PRODUCTS_QUERY_DEFAULTS.sortBy,
        example: PRODUCTS_QUERY_DEFAULTS.sortBy,
      },
    }),

    ApiQuery({
      name: 'sortOrder',
      required: false,
      description: 'Sorting direction.',
      schema: {
        type: 'string',
        enum: [...PRODUCTS_SORT_ORDERS],
        default: PRODUCTS_QUERY_DEFAULTS.sortOrder,
        example: PRODUCTS_QUERY_DEFAULTS.sortOrder,
      },
    }),

    ApiQuery({
      name: 'search',
      required: false,
      description: 'Search term used to filter products.',
      schema: {
        type: 'string',
        minLength: PRODUCTS_SEARCH_LENGTH.MIN,
        maxLength: PRODUCTS_SEARCH_LENGTH.MAX,
        example: 'notebook',
      },
    }),
  );
}
