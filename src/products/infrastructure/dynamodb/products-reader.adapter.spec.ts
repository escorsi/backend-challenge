import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '@nestjs/config';

import type { ProductCursorCodec } from '../../application/ports/product-cursor-codec.port';
import { InvalidProductCursorError } from '../../application/errors/invalid-product-cursor.error';

import { ProductsReaderAdapter } from './products-reader.adapter';
import { ProductCursorManager } from './product-cursor.manager';
import type { ProductCursor } from './models/product-cursor.interface';
import { ProductStatus } from '../../domain/enums/product-status.enum';

describe('ProductsReaderAdapter', () => {
  let reader: ProductsReaderAdapter;
  let documentClient: DynamoDBDocumentClient;
  let cursorCodec: ProductCursorCodec;

  const tableName = 'products';

  const product = {
    id: 'product-1',
    name: 'Notebook',
    description: 'High performance notebook',
    priceInCents: 450000,
    status: ProductStatus.ACTIVE,
    createdAt: '2026-11-24T10:00:00.000Z',
    createdAtId: '2026-11-24T10:00:00.000Z#product-1',
    nameSort: 'notebook#product-1',
    priceSort: '000000000450000#product-1',
    descriptionSearch: 'high performance notebook',
  };

  const toDomainProduct = (item: typeof product) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    priceInCents: item.priceInCents,
    status: item.status,
    createdAt: item.createdAt,
  });

  const lastEvaluatedKey = {
    id: product.id,
    status: ProductStatus.ACTIVE,
    createdAtId: '2026-11-24T10:00:00.000Z#product-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    documentClient = {
      send: vi.fn(),
    } as unknown as DynamoDBDocumentClient;

    cursorCodec = {
      encode: vi.fn().mockReturnValue('signed-cursor'),
      decode: vi.fn(),
    };

    const configService = {
      getOrThrow: vi.fn().mockReturnValue(tableName),
    } as unknown as ConfigService;

    reader = new ProductsReaderAdapter(
      documentClient,
      configService,
      new ProductCursorManager(cursorCodec),
    );
  });

  describe('findAll', () => {
    it('should return active products ordered by creation date', async () => {
      vi.mocked(documentClient.send).mockResolvedValueOnce({
        Items: [product],
      } as never);

      const result = await reader.findAll({
        pageSize: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      const command = vi.mocked(documentClient.send).mock
        .calls[0][0] as QueryCommand;

      expect(command.input).toMatchObject({
        TableName: tableName,
        IndexName: 'status-created-at-index',
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeValues: {
          ':status': ProductStatus.ACTIVE,
        },
        ScanIndexForward: false,
        Limit: 21,
      });

      expect(result.items).toEqual([toDomainProduct(product)]);
      expect(result.pagination).toEqual({
        pageSize: 1,
        nextCursor: null,
        hasNextPage: false,
      });
    });

    it('should return an empty page when DynamoDB omits Items', async () => {
      vi.mocked(documentClient.send).mockResolvedValueOnce({} as never);

      await expect(
        reader.findAll({
          pageSize: 20,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }),
      ).resolves.toEqual({
        items: [],
        pagination: {
          pageSize: 0,
          nextCursor: null,
          hasNextPage: false,
        },
      });
    });

    it('should use the name index when sorting by name', async () => {
      vi.mocked(documentClient.send).mockResolvedValueOnce({
        Items: [product],
      } as never);

      await reader.findAll({
        pageSize: 20,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      const command = vi.mocked(documentClient.send).mock
        .calls[0][0] as QueryCommand;

      expect(command.input.IndexName).toBe('status-name-index');
      expect(command.input.ScanIndexForward).toBe(true);
    });

    it('should use the price index when sorting by price', async () => {
      vi.mocked(documentClient.send).mockResolvedValueOnce({
        Items: [product],
      } as never);

      await reader.findAll({
        pageSize: 20,
        sortBy: 'price',
        sortOrder: 'desc',
      });

      const command = vi.mocked(documentClient.send).mock
        .calls[0][0] as QueryCommand;

      expect(command.input.IndexName).toBe('status-price-index');
      expect(command.input.ScanIndexForward).toBe(false);
    });

    it('should apply search filters', async () => {
      vi.mocked(documentClient.send).mockResolvedValueOnce({
        Items: [product],
      } as never);

      await reader.findAll({
        pageSize: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        searchTerm: '  NOTEBOOK  ',
      });

      const command = vi.mocked(documentClient.send).mock
        .calls[0][0] as QueryCommand;

      expect(command.input.FilterExpression).toContain(
        'contains(#nameSort, :searchTerm)',
      );

      expect(command.input.FilterExpression).toContain(
        'contains(#descriptionSearch, :searchTerm)',
      );

      expect(command.input.ExpressionAttributeValues).toMatchObject({
        ':searchTerm': 'notebook',
      });
      expect(command.input.Limit).toBe(100);
    });

    it('should filter name-index searches in memory because nameSort is that index key', async () => {
      vi.mocked(documentClient.send).mockResolvedValueOnce({
        Items: [product],
      } as never);

      const result = await reader.findAll({
        pageSize: 20,
        sortBy: 'name',
        sortOrder: 'asc',
        searchTerm: 'notebook',
      });

      const command = vi.mocked(documentClient.send).mock
        .calls[0][0] as QueryCommand;

      expect(command.input.FilterExpression).toBeUndefined();
      expect(result.items).toEqual([toDomainProduct(product)]);
    });

    it('should match a name-index search against the description when the name does not match', async () => {
      const descriptionMatch = {
        ...product,
        name: 'USB-C Dock',
        nameSort: 'usb-c dock#product-1',
        descriptionSearch: 'compact workstation connector',
      };
      vi.mocked(documentClient.send).mockResolvedValueOnce({
        Items: [descriptionMatch],
      } as never);

      const result = await reader.findAll({
        pageSize: 20,
        sortBy: 'name',
        sortOrder: 'asc',
        searchTerm: 'workstation',
      });

      expect(result.items).toEqual([toDomainProduct(descriptionMatch)]);
    });

    it('should preserve unreturned matches when a search batch exceeds the page size', async () => {
      const nextProduct = {
        ...product,
        id: 'product-2',
        createdAtId: '2026-11-24T10:01:00.000Z#product-2',
      };

      vi.mocked(documentClient.send).mockResolvedValueOnce({
        Items: [product, nextProduct],
        LastEvaluatedKey: {
          id: nextProduct.id,
          status: ProductStatus.ACTIVE,
          createdAtId: nextProduct.createdAtId,
        },
      } as never);

      const result = await reader.findAll({
        pageSize: 1,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        searchTerm: 'notebook',
      });

      expect(result.items).toEqual([toDomainProduct(product)]);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(cursorCodec.encode).toHaveBeenCalledWith(
        expect.objectContaining({
          lastEvaluatedKey,
        }),
      );
    });

    it('should bound DynamoDB work and return a continuation cursor for sparse searches', async () => {
      const lastBatchKey = {
        id: 'scan-5',
        status: ProductStatus.ACTIVE,
        createdAtId: '2026-11-24T10:05:00.000Z#scan-5',
      };

      for (let batch = 1; batch <= 5; batch += 1) {
        vi.mocked(documentClient.send).mockResolvedValueOnce({
          Items: [],
          LastEvaluatedKey: {
            id: `scan-${batch}`,
            status: ProductStatus.ACTIVE,
            createdAtId: `2026-11-24T10:0${batch}:00.000Z#scan-${batch}`,
          },
        } as never);
      }

      const result = await reader.findAll({
        pageSize: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        searchTerm: 'rare',
      });

      expect(documentClient.send).toHaveBeenCalledTimes(5);
      expect(result.items).toEqual([]);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(cursorCodec.encode).toHaveBeenCalledWith(
        expect.objectContaining({
          lastEvaluatedKey: lastBatchKey,
        }),
      );
    });

    it('should continue querying when filters return fewer items than requested', async () => {
      const secondProduct = {
        ...product,
        id: 'product-2',
        name: 'Another notebook',
      };

      vi.mocked(documentClient.send)
        .mockResolvedValueOnce({
          Items: [],
          LastEvaluatedKey: lastEvaluatedKey,
        } as never)
        .mockResolvedValueOnce({
          Items: [secondProduct],
        } as never);

      const result = await reader.findAll({
        pageSize: 1,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        searchTerm: 'notebook',
      });

      const secondCommand = vi.mocked(documentClient.send).mock
        .calls[1][0] as QueryCommand;

      expect(secondCommand.input.ExclusiveStartKey).toEqual(lastEvaluatedKey);
      expect(documentClient.send).toHaveBeenCalledTimes(2);
      expect(result.items).toEqual([toDomainProduct(secondProduct)]);
      expect(result.pagination.hasNextPage).toBe(false);
    });

    it('should return a signed cursor when more results are available', async () => {
      const nextProduct = {
        ...product,
        id: 'product-2',
        name: 'Keyboard',
      };

      vi.mocked(documentClient.send)
        .mockResolvedValueOnce({
          Items: [product],
          LastEvaluatedKey: lastEvaluatedKey,
        } as never)
        .mockResolvedValueOnce({
          Items: [nextProduct],
        } as never);

      const result = await reader.findAll({
        pageSize: 1,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(documentClient.send).toHaveBeenCalledTimes(2);

      expect(cursorCodec.encode).toHaveBeenCalledWith({
        lastEvaluatedKey,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        searchTerm: undefined,
      });

      expect(result.pagination).toEqual({
        pageSize: 1,
        nextCursor: 'signed-cursor',
        hasNextPage: true,
      });
    });

    it('should use the cursor when continuing pagination', async () => {
      const cursor: ProductCursor = {
        lastEvaluatedKey,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      vi.mocked(cursorCodec.decode).mockReturnValue(cursor);

      vi.mocked(documentClient.send).mockResolvedValueOnce({
        Items: [product],
      } as never);

      await reader.findAll({
        pageSize: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        cursor: 'signed-cursor',
      });

      const command = vi.mocked(documentClient.send).mock
        .calls[0][0] as QueryCommand;

      expect(cursorCodec.decode).toHaveBeenCalledWith('signed-cursor');

      expect(command.input.ExclusiveStartKey).toEqual(lastEvaluatedKey);
    });

    it('should reject a cursor with different query parameters', async () => {
      const cursor: ProductCursor = {
        lastEvaluatedKey,
        sortBy: 'price',
        sortOrder: 'desc',
      };

      vi.mocked(cursorCodec.decode).mockReturnValue(cursor);

      await expect(
        reader.findAll({
          pageSize: 20,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          cursor: 'signed-cursor',
        }),
      ).rejects.toThrow(InvalidProductCursorError);

      expect(documentClient.send).not.toHaveBeenCalled();
    });

    it('should propagate DynamoDB errors', async () => {
      const error = new Error('DynamoDB unavailable');

      vi.mocked(documentClient.send).mockRejectedValueOnce(error);

      await expect(
        reader.findAll({
          pageSize: 20,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }),
      ).rejects.toThrow(error);
    });

    it('should reject a cursor without a valid last evaluated key', async () => {
      vi.mocked(cursorCodec.decode).mockReturnValue({
        sortBy: 'createdAt',
        sortOrder: 'desc',
        lastEvaluatedKey: undefined,
      } as unknown as ProductCursor);

      await expect(
        reader.findAll({
          pageSize: 20,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          cursor: 'invalid-cursor',
        }),
      ).rejects.toThrow(InvalidProductCursorError);

      expect(documentClient.send).not.toHaveBeenCalled();
    });

    it('should reject a cursor whose envelope is valid but DynamoDB key is malformed', async () => {
      vi.mocked(cursorCodec.decode).mockReturnValue({
        lastEvaluatedKey: {
          id: 123,
          status: ProductStatus.ACTIVE,
          createdAtId: lastEvaluatedKey.createdAtId,
        },
        sortBy: 'createdAt',
        sortOrder: 'desc',
      } as unknown as ProductCursor);

      await expect(
        reader.findAll({
          pageSize: 20,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          cursor: 'signed-cursor',
        }),
      ).rejects.toThrow(InvalidProductCursorError);

      expect(documentClient.send).not.toHaveBeenCalled();
    });

    it('should reject a cursor with a different search term', async () => {
      const cursor: ProductCursor = {
        lastEvaluatedKey,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        searchTerm: 'notebook',
      };

      vi.mocked(cursorCodec.decode).mockReturnValue(cursor);

      await expect(
        reader.findAll({
          pageSize: 20,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          searchTerm: 'keyboard',
          cursor: 'signed-cursor',
        }),
      ).rejects.toThrow(InvalidProductCursorError);

      expect(documentClient.send).not.toHaveBeenCalled();
    });

    it('should allow changing the page size when continuing pagination', async () => {
      const cursor: ProductCursor = {
        lastEvaluatedKey,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      vi.mocked(cursorCodec.decode).mockReturnValue(cursor);
      vi.mocked(documentClient.send).mockResolvedValueOnce({
        Items: [product],
      } as never);

      await expect(
        reader.findAll({
          pageSize: 5,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          cursor: 'signed-cursor',
        }),
      ).resolves.toMatchObject({ pagination: { pageSize: 1 } });

      expect(documentClient.send).toHaveBeenCalledTimes(1);
    });

    it('should encode the cursor with a normalized search term', async () => {
      vi.mocked(documentClient.send)
        .mockResolvedValueOnce({
          Items: [product],
          LastEvaluatedKey: lastEvaluatedKey,
        } as never)
        .mockResolvedValueOnce({
          Items: [
            {
              ...product,
              id: 'product-2',
            },
          ],
        } as never);

      await reader.findAll({
        pageSize: 1,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        searchTerm: '  NOTEBOOK  ',
      });

      expect(cursorCodec.encode).toHaveBeenCalledWith(
        expect.objectContaining({
          lastEvaluatedKey,
          searchTerm: 'notebook',
        }),
      );

      expect(documentClient.send).toHaveBeenCalledTimes(2);
    });
  });
});
