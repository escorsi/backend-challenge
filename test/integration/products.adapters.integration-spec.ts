import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';

import { ProductsReaderAdapter } from '../../src/products/infrastructure/dynamodb/products-reader.adapter';
import { ProductsWriterAdapter } from '../../src/products/infrastructure/dynamodb/products-writer.adapter';
import { ProductCursorManager } from '../../src/products/infrastructure/dynamodb/product-cursor.manager';
import { ProductStatus } from '../../src/products/domain/enums/product-status.enum';
import { SignedProductCursorCodecAdapter } from '../../src/products/infrastructure/security/signed-product-cursor-codec.adapter';

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
    for (const product of products) {
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
    for (const product of products) {
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
        nameSort: 'notebook#integration-product-1',
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
  });
});
