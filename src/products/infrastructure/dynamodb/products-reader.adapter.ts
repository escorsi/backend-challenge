import { Inject, Injectable } from '@nestjs/common';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  type QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '@nestjs/config';

import type { ProductsReaderPort } from '../../application/ports/products-reader.port';
import type { FindProductsParams } from '../../domain/models/product.interface';
import type { PaginatedProducts } from '../../domain/models/product-pagination.interface';
import { ProductStatus } from '../../domain/enums/product-status.enum';
import { DYNAMODB_DOCUMENT_CLIENT } from '../../../database/dynamodb/dynamodb.constants';
import { PRODUCT_INDEXES } from './constants/product-indexes.constants';
import {
  MAX_SEARCH_QUERY_BATCHES_PER_REQUEST,
  SEARCH_QUERY_BATCH_SIZE,
} from './constants/products-query.constants';
import type { ProductCursorKey } from './models/product-cursor.interface';
import type { ProductItem } from './models/product-item.interface';
import { toProduct } from './mappers/product-item.mapper';
import { ProductCursorManager } from './product-cursor.manager';

@Injectable()
export class ProductsReaderAdapter implements ProductsReaderPort {
  private readonly tableName: string;

  constructor(
    @Inject(DYNAMODB_DOCUMENT_CLIENT)
    private readonly documentClient: DynamoDBDocumentClient,
    configService: ConfigService,
    private readonly cursorManager: ProductCursorManager,
  ) {
    this.tableName = configService.getOrThrow<string>(
      'DYNAMODB_PRODUCTS_TABLE',
    );
  }

  async findAll(params: FindProductsParams): Promise<PaginatedProducts> {
    const normalizedSearchTerm = params.searchTerm?.trim().toLowerCase();
    const cursor = this.cursorManager.decode(
      params.cursor,
      params,
      normalizedSearchTerm,
    );
    let lastEvaluatedKey: ProductCursorKey | undefined =
      cursor?.lastEvaluatedKey;
    const items: ProductItem[] = [];
    let queryCount = 0;

    while (
      items.length <= params.pageSize &&
      queryCount <
        (normalizedSearchTerm
          ? MAX_SEARCH_QUERY_BATCHES_PER_REQUEST
          : Number.POSITIVE_INFINITY)
    ) {
      const remainingItemsIncludingLookahead =
        params.pageSize + 1 - items.length;
      const result = await this.documentClient.send(
        new QueryCommand(
          this.buildQueryInput(
            params,
            normalizedSearchTerm,
            normalizedSearchTerm
              ? SEARCH_QUERY_BATCH_SIZE
              : remainingItemsIncludingLookahead,
            lastEvaluatedKey,
          ),
        ),
      );
      queryCount += 1;

      const batchItems = (result.Items ?? []) as ProductItem[];
      items.push(
        ...this.filterBatch(batchItems, params.sortBy, normalizedSearchTerm),
      );

      lastEvaluatedKey = result.LastEvaluatedKey;

      if (!lastEvaluatedKey) {
        break;
      }
    }

    return this.createPage(
      items,
      params,
      normalizedSearchTerm,
      lastEvaluatedKey,
    );
  }

  private buildQueryInput(
    params: FindProductsParams,
    normalizedSearchTerm: string | undefined,
    limit: number,
    exclusiveStartKey?: ProductCursorKey,
  ): QueryCommandInput {
    const queryInput: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: PRODUCT_INDEXES[params.sortBy].indexName,
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': ProductStatus.ACTIVE },
      ScanIndexForward: params.sortOrder === 'asc',
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
    };

    if (normalizedSearchTerm && params.sortBy !== 'name') {
      queryInput.FilterExpression =
        'contains(#nameSort, :searchTerm) OR contains(#descriptionSearch, :searchTerm)';
      queryInput.ExpressionAttributeNames = {
        ...queryInput.ExpressionAttributeNames,
        '#nameSort': 'nameSort',
        '#descriptionSearch': 'descriptionSearch',
      };
      queryInput.ExpressionAttributeValues = {
        ...queryInput.ExpressionAttributeValues,
        ':searchTerm': normalizedSearchTerm,
      };
    }

    return queryInput;
  }

  private filterBatch(
    items: ProductItem[],
    sortBy: FindProductsParams['sortBy'],
    searchTerm?: string,
  ): ProductItem[] {
    if (!searchTerm || sortBy !== 'name') {
      return items;
    }

    return items.filter(
      (item) =>
        item.nameSort.includes(searchTerm) ||
        item.descriptionSearch.includes(searchTerm),
    );
  }

  private createPage(
    items: ProductItem[],
    params: FindProductsParams,
    normalizedSearchTerm: string | undefined,
    lastEvaluatedKey: ProductCursorKey | undefined,
  ): PaginatedProducts {
    const hasUnreturnedItems = items.length > params.pageSize;
    const pageItemRecords = items.slice(0, params.pageSize);
    const pageProducts = pageItemRecords.map(toProduct);
    const hasNextPage = hasUnreturnedItems || Boolean(lastEvaluatedKey);
    const nextPageStartKey = hasUnreturnedItems
      ? this.cursorManager.createKey(
          pageItemRecords[pageItemRecords.length - 1],
          params.sortBy,
        )
      : lastEvaluatedKey;
    const nextCursor =
      hasNextPage && nextPageStartKey
        ? this.cursorManager.encode({
            lastEvaluatedKey: nextPageStartKey,
            sortBy: params.sortBy,
            sortOrder: params.sortOrder,
            searchTerm: normalizedSearchTerm,
          })
        : null;

    return {
      items: pageProducts,
      pagination: {
        pageSize: pageProducts.length,
        nextCursor,
        hasNextPage,
      },
    };
  }
}
