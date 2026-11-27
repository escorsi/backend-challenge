export const PRODUCTS_QUERY_LIMIT = {
  DEFAULT: 20,
  MIN: 1,
  MAX: 100,
} as const;

export const PRODUCTS_SEARCH_LENGTH = {
  MIN: 1,
  MAX: 100,
} as const;

export const PRODUCTS_SORT_FIELDS = ['createdAt', 'name', 'price'] as const;

export const PRODUCTS_SORT_ORDERS = ['asc', 'desc'] as const;

export const PRODUCTS_QUERY_DEFAULTS = {
  sortBy: 'createdAt',
  sortOrder: 'desc',
} as const;
