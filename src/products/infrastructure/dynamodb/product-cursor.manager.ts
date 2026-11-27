import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';

import type {
  FindProductsParams,
  ProductSortBy,
} from '../../domain/models/product.interface';
import { ProductStatus } from '../../domain/enums/product-status.enum';
import { InvalidProductCursorError } from '../../application/errors/invalid-product-cursor.error';
import {
  PRODUCT_CURSOR_CODEC,
  type ProductCursorCodec,
} from '../../application/ports/product-cursor-codec.port';
import { PRODUCT_INDEXES } from './constants/product-indexes.constants';
import type {
  ProductCursor,
  ProductCursorKey,
} from './models/product-cursor.interface';
import type { ProductItem } from './models/product-item.interface';

const cursorSchema = z.object({
  lastEvaluatedKey: z
    .record(z.string(), z.unknown())
    .refine((key) => Object.keys(key).length > 0),
  sortBy: z.enum(['createdAt', 'name', 'price']),
  sortOrder: z.enum(['asc', 'desc']),
  searchTerm: z.string().optional(),
});

@Injectable()
export class ProductCursorManager {
  constructor(
    @Inject(PRODUCT_CURSOR_CODEC)
    private readonly codec: ProductCursorCodec,
  ) {}

  decode(
    token: string | undefined,
    params: FindProductsParams,
    normalizedSearchTerm?: string,
  ): ProductCursor | undefined {
    if (!token) {
      return undefined;
    }

    const result = cursorSchema.safeParse(this.codec.decode<unknown>(token));

    if (!result.success) {
      throw new InvalidProductCursorError();
    }

    const cursor = result.data as ProductCursor;
    this.validate(cursor, params, normalizedSearchTerm);

    return cursor;
  }

  createKey(product: ProductItem, sortBy: ProductSortBy): ProductCursorKey {
    const sortKey = PRODUCT_INDEXES[sortBy].sortKey;

    return {
      id: product.id,
      status: product.status,
      [sortKey]: product[sortKey],
    };
  }

  encode(cursor: ProductCursor): string {
    return this.codec.encode(cursor);
  }

  private validate(
    cursor: ProductCursor,
    params: FindProductsParams,
    normalizedSearchTerm?: string,
  ): void {
    const key = cursor.lastEvaluatedKey;
    const sortKey = PRODUCT_INDEXES[params.sortBy].sortKey;

    if (
      !key ||
      typeof key !== 'object' ||
      Array.isArray(key) ||
      Object.keys(key).length === 0 ||
      typeof key.id !== 'string' ||
      key.status !== ProductStatus.ACTIVE ||
      typeof key[sortKey] !== 'string'
    ) {
      throw new InvalidProductCursorError();
    }

    const matchesQuery =
      cursor.sortBy === params.sortBy &&
      cursor.sortOrder === params.sortOrder &&
      cursor.searchTerm === normalizedSearchTerm;

    if (!matchesQuery) {
      throw new InvalidProductCursorError(
        'Cursor does not match the current query parameters',
      );
    }
  }
}
