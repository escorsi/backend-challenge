import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '@nestjs/config';

import { ProductStatus } from '../../domain/enums/product-status.enum';
import { ProductsWriterAdapter } from './products-writer.adapter';

describe('ProductsWriterAdapter', () => {
  let writer: ProductsWriterAdapter;
  let documentClient: DynamoDBDocumentClient;

  const tableName = 'products';
  const productToCreate = {
    id: 'product-2',
    name: 'Wireless Headphones',
    description: 'Wireless headphones with noise cancellation.',
    priceInCents: 59990,
    status: ProductStatus.ACTIVE,
    createdAt: '2026-11-25T15:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    documentClient = {
      send: vi.fn(),
    } as unknown as DynamoDBDocumentClient;

    const configService = {
      getOrThrow: vi.fn().mockReturnValue(tableName),
    } as unknown as ConfigService;

    writer = new ProductsWriterAdapter(documentClient, configService);
  });

  it('persists a product with its index attributes and returns the domain product', async () => {
    vi.mocked(documentClient.send).mockResolvedValueOnce({} as never);

    const result = await writer.create(productToCreate);

    expect(documentClient.send).toHaveBeenCalledTimes(1);

    const command = vi.mocked(documentClient.send).mock
      .calls[0][0] as PutCommand;

    expect(command.input).toEqual({
      TableName: tableName,
      Item: {
        ...productToCreate,
        createdAtId: `${productToCreate.createdAt}#${productToCreate.id}`,
        nameSort: `wireless headphones#${productToCreate.id}`,
        priceSort: `000000000059990#${productToCreate.id}`,
        descriptionSearch: 'wireless headphones with noise cancellation.',
      },
      ConditionExpression: 'attribute_not_exists(#id)',
      ExpressionAttributeNames: { '#id': 'id' },
    });
    expect(result).toEqual(productToCreate);
  });

  it('propagates DynamoDB errors', async () => {
    const error = new Error('DynamoDB unavailable');
    vi.mocked(documentClient.send).mockRejectedValueOnce(error);

    await expect(writer.create(productToCreate)).rejects.toThrow(error);
  });
});
