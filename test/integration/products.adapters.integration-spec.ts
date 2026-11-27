import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

import { ProductsReaderAdapter } from '../../src/products/infrastructure/dynamodb/products-reader.adapter';
import { ProductsWriterAdapter } from '../../src/products/infrastructure/dynamodb/products-writer.adapter';
import { ProductCursorManager } from '../../src/products/infrastructure/dynamodb/product-cursor.manager';
import { ProductStatus } from '../../src/products/domain/enums/product-status.enum';
import { SignedProductCursorCodecAdapter } from '../../src/products/infrastructure/security/signed-product-cursor-codec.adapter';
import { backfillProductNames } from '../../src/products/infrastructure/dynamodb/migrations/backfill-product-names';

import type {
  CreateProductParams,
  FindProductsParams,
} from '../../src/products/domain/models/product.interface';

describe('Products DynamoDB adapters integration', () => {
  const tableName = 'products-integration';

  const client = new DynamoDBClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    endpoint: process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000',
    credentials: {
      accessKeyId: 'local',
      secretAccessKey: 'local',
    },
  });

  const documentClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  });

  const configService = {
    getOrThrow: () => tableName,
  } as unknown as ConfigService;

  const cursorConfigService = {
    getOrThrow: () =>
      process.env.CURSOR_SECRET ??
      'test-cursor-secret-with-at-least-32-characters',
  } as unknown as ConfigService;

  const cursorCodec = new SignedProductCursorCodecAdapter(cursorConfigService);

  const reader = new ProductsReaderAdapter(
    documentClient,
    configService,
    new ProductCursorManager(cursorCodec),
  );
  const writer = new ProductsWriterAdapter(documentClient, configService);

  const products: CreateProductParams[] = [
    {
      id: 'integration-product-1',
      name: 'Notebook',
      description: 'High performance notebook',
      priceInCents: 450000,
      status: ProductStatus.ACTIVE,
      createdAt: '2026-11-24T10:00:00.000Z',
    },
    {
      id: 'integration-product-2',
      name: 'Smartphone',
      description: 'Android smartphone',
      priceInCents: 250000,
      status: ProductStatus.ACTIVE,
      createdAt: '2026-11-24T11:00:00.000Z',
    },
    {
      id: 'integration-product-3',
      name: 'Inactive product',
      description: 'Inactive product description',
      priceInCents: 100000,
      status: ProductStatus.INACTIVE,
      createdAt: '2026-11-24T12:00:00.000Z',
    },
  ];

  const prefixedProduct: CreateProductParams = {
    ...products[0],
    id: 'integration-product-prefix',
    name: 'Notebook Pro',
  };
  const duplicateNameProduct: CreateProductParams = {
    ...products[0],
    id: 'integration-product-duplicate',
    name: 'NOTEBOOK',
  };
  const allProducts = [...products, prefixedProduct, duplicateNameProduct];

  beforeAll(async () => {
    await client
      .send(
        new DeleteCommand({
          TableName: tableName,
          Key: {
            id: 'integration-product-1',
          },
        }),
      )
      .catch(() => undefined);

    await client
      .send(
        new DeleteCommand({
          TableName: tableName,
          Key: {
            id: 'integration-product-2',
          },
        }),
      )
      .catch(() => undefined);

    await client
      .send(
        new DeleteCommand({
          TableName: tableName,
          Key: {
            id: 'integration-product-3',
          },
        }),
      )
      .catch(() => undefined);
  });

  beforeEach(async () => {
    for (const product of allProducts) {
      await documentClient.send(
        new DeleteCommand({
          TableName: tableName,
          Key: {
            id: product.id,
          },
        }),
      );
    }
  });

  afterAll(async () => {
    for (const product of allProducts) {
      await documentClient.send(
        new DeleteCommand({
          TableName: tableName,
          Key: {
            id: product.id,
          },
        }),
      );
    }

    documentClient.destroy();
  });

  async function seedProducts(): Promise<void> {
    for (const product of products) {
      await writer.create(product);
    }
  }

  const defaultParams: FindProductsParams = {
    pageSize: 20,
    sortBy: 'createdAt',
    sortOrder: 'asc',
  };

  describe('create', () => {
    it('should persist a product with its derived attributes', async () => {
      const product = await writer.create(products[0]);
      const { Item } = await documentClient.send(
        new GetCommand({
          TableName: tableName,
          Key: { id: products[0].id },
        }),
      );

      expect(product).toEqual(products[0]);
      expect(Item).toEqual({
        ...products[0],
        createdAtId: `${products[0].createdAt}#${products[0].id}`,
        nameSort: 'notebook',
        nameSearch: 'notebook',
        priceSort: '000000000450000#integration-product-1',
        descriptionSearch: 'high performance notebook',
      });
    });
  });

  describe('findAll', () => {
    it('should return only active products', async () => {
      await seedProducts();

      const result = await reader.findAll(defaultParams);

      expect(result.items).toHaveLength(2);
      expect(
        result.items.every((item) => item.status === ProductStatus.ACTIVE),
      ).toBe(true);
    });

    it('should sort products by creation date', async () => {
      await seedProducts();

      const result = await reader.findAll(defaultParams);

      expect(result.items.map((item) => item.id)).toEqual([
        'integration-product-1',
        'integration-product-2',
      ]);
    });

    it('should sort products by name', async () => {
      await seedProducts();

      const result = await reader.findAll({
        ...defaultParams,
        sortBy: 'name',
      });

      expect(result.items.map((item) => item.name)).toEqual([
        'Notebook',
        'Smartphone',
      ]);
    });

    it('should sort products by price', async () => {
      await seedProducts();

      const result = await reader.findAll({
        ...defaultParams,
        sortBy: 'price',
      });

      expect(result.items.map((item) => item.priceInCents)).toEqual([
        250000, 450000,
      ]);
    });

    it('should filter products by search term', async () => {
      await seedProducts();

      const result = await reader.findAll({
        ...defaultParams,
        searchTerm: 'android',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('integration-product-2');
    });

    it('should search by name while using the name sorting index', async () => {
      await seedProducts();

      const result = await reader.findAll({
        ...defaultParams,
        sortBy: 'name',
        searchTerm: 'notebook',
      });

      expect(result.items.map((item) => item.id)).toEqual([
        'integration-product-1',
      ]);
    });

    it.each(['createdAt', 'name', 'price'] as const)(
      'does not match identifiers or key separators when sorting by %s',
      async (sortBy) => {
        await seedProducts();

        for (const searchTerm of [products[0].id, '#']) {
          const result = await reader.findAll({
            ...defaultParams,
            sortBy,
            searchTerm,
          });

          expect(result.items).toEqual([]);
          expect(result.pagination.hasNextPage).toBe(false);
        }
      },
    );

    it('matches descriptions when searching on the name index', async () => {
      await seedProducts();

      const result = await reader.findAll({
        ...defaultParams,
        sortBy: 'name',
        searchTerm: 'ANDROID',
      });

      expect(result.items.map((item) => item.id)).toEqual([products[1].id]);
    });

    it.each(['asc', 'desc'] as const)(
      'preserves prefix ordering when sorting names %s',
      async (sortOrder) => {
        await seedProducts();
        await writer.create(prefixedProduct);

        const result = await reader.findAll({
          ...defaultParams,
          sortBy: 'name',
          sortOrder,
          searchTerm: 'notebook',
        });

        const expected = [products[0].name, prefixedProduct.name];
        expect(result.items.map((item) => item.name)).toEqual(
          sortOrder === 'asc' ? expected : expected.toReversed(),
        );
      },
    );

    it.each(['asc', 'desc'] as const)(
      'paginates equal normalized names without skipping or repeating products (%s)',
      async (sortOrder) => {
        await seedProducts();
        await writer.create(duplicateNameProduct);

        const params: FindProductsParams = {
          pageSize: 1,
          sortBy: 'name',
          sortOrder,
          searchTerm: 'notebook',
        };
        const firstPage = await reader.findAll(params);
        const secondPage = await reader.findAll({
          ...params,
          cursor: firstPage.pagination.nextCursor!,
        });

        expect(firstPage.items).toHaveLength(1);
        expect(firstPage.pagination.hasNextPage).toBe(true);
        expect(secondPage.items).toHaveLength(1);
        expect(secondPage.pagination.hasNextPage).toBe(false);
        expect(
          new Set(
            [...firstPage.items, ...secondPage.items].map((item) => item.id),
          ),
        ).toEqual(new Set([products[0].id, duplicateNameProduct.id]));
      },
    );

    it('should paginate results using a cursor', async () => {
      await seedProducts();

      const firstPage = await reader.findAll({
        ...defaultParams,
        pageSize: 1,
      });

      expect(firstPage.items).toHaveLength(1);
      expect(firstPage.pagination.hasNextPage).toBe(true);
      expect(firstPage.pagination.nextCursor).toEqual(expect.any(String));

      const secondPage = await reader.findAll({
        ...defaultParams,
        pageSize: 1,
        cursor: firstPage.pagination.nextCursor!,
      });

      expect(secondPage.items).toHaveLength(1);
      expect(secondPage.items[0].id).not.toBe(firstPage.items[0].id);
      expect(secondPage.pagination.hasNextPage).toBe(false);
    });

    it('limits dense search pages to the requested item and one lookahead', async () => {
      await seedProducts();
      await writer.create(prefixedProduct);
      const send = vi.spyOn(documentClient, 'send');

      try {
        const params: FindProductsParams = {
          pageSize: 1,
          sortBy: 'name',
          sortOrder: 'asc',
          searchTerm: 't',
        };
        const first = await reader.findAll(params);
        const second = await reader.findAll({
          ...params,
          cursor: first.pagination.nextCursor!,
        });
        const third = await reader.findAll({
          ...params,
          cursor: second.pagination.nextCursor!,
        });

        expect(
          [first, second, third].flatMap((page) =>
            page.items.map((item) => item.name),
          ),
        ).toEqual(['Notebook', 'Notebook Pro', 'Smartphone']);
        expect(third.pagination.hasNextPage).toBe(false);
        expect(
          send.mock.calls.map(
            ([command]) =>
              (command as { input: { Limit?: number } }).input.Limit,
          ),
        ).toEqual([2, 2, 2]);
      } finally {
        send.mockRestore();
      }
    });
  });

  it('previews and migrates legacy name attributes without changing product data', async () => {
    await writer.create(products[0]);
    await documentClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { id: products[0].id },
        UpdateExpression: 'SET #nameSort = :legacyNameSort REMOVE #nameSearch',
        ExpressionAttributeNames: {
          '#nameSort': 'nameSort',
          '#nameSearch': 'nameSearch',
        },
        ExpressionAttributeValues: {
          ':legacyNameSort': `notebook#${products[0].id}`,
        },
      }),
    );
    const getProduct = () =>
      documentClient.send(
        new GetCommand({
          TableName: tableName,
          Key: { id: products[0].id },
          ConsistentRead: true,
        }),
      );
    const before = await getProduct();

    const preview = await backfillProductNames(documentClient, tableName);
    expect(preview.needsUpdate).toBeGreaterThanOrEqual(1);
    expect(preview.updated).toBe(0);
    expect((await getProduct()).Item).toEqual(before.Item);

    const applied = await backfillProductNames(
      documentClient,
      tableName,
      false,
    );
    expect(applied.updated).toBeGreaterThanOrEqual(1);
    expect(applied.conflicts).toBe(0);
    expect((await getProduct()).Item).toEqual({
      ...before.Item,
      nameSort: 'notebook',
      nameSearch: 'notebook',
    });
    expect(
      await backfillProductNames(documentClient, tableName, false),
    ).toMatchObject({
      needsUpdate: 0,
      updated: 0,
      conflicts: 0,
    });
  });
});
