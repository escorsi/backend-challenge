import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

import { backfillProductNames } from './backfill-product-names';

describe('backfillProductNames', () => {
  const legacyProduct = {
    id: 'product-1',
    name: ' Notebook ',
    nameSort: 'notebook#product-1',
  };
  let send: ReturnType<typeof vi.fn>;
  let client: DynamoDBDocumentClient;

  beforeEach(() => {
    send = vi.fn();
    client = { send } as unknown as DynamoDBDocumentClient;
  });

  it('previews outdated records without issuing writes', async () => {
    send.mockResolvedValueOnce({ Items: [legacyProduct] });

    expect(await backfillProductNames(client, 'products')).toEqual({
      scanned: 1,
      needsUpdate: 1,
      updated: 0,
      conflicts: 0,
    });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0]).toBeInstanceOf(ScanCommand);
  });

  it('traverses scan pages and only updates outdated attributes with a name precondition', async () => {
    const lastKey = { id: 'current-product' };
    send
      .mockResolvedValueOnce({
        Items: [
          {
            id: 'current-product',
            name: 'Mouse',
            nameSort: 'mouse',
            nameSearch: 'mouse',
          },
        ],
        LastEvaluatedKey: lastKey,
      })
      .mockResolvedValueOnce({ Items: [legacyProduct] })
      .mockResolvedValueOnce({});

    expect(await backfillProductNames(client, 'products', false)).toEqual({
      scanned: 2,
      needsUpdate: 1,
      updated: 1,
      conflicts: 0,
    });
    expect(
      (send.mock.calls[1][0] as ScanCommand).input.ExclusiveStartKey,
    ).toEqual(lastKey);
    const update = send.mock.calls[2][0] as UpdateCommand;
    expect(update).toBeInstanceOf(UpdateCommand);
    expect(update.input).toMatchObject({
      Key: { id: legacyProduct.id },
      ConditionExpression: 'attribute_exists(#id) AND #name = :name',
      ExpressionAttributeValues: {
        ':name': legacyProduct.name,
        ':nameSort': 'notebook',
        ':nameSearch': 'notebook',
      },
    });
  });

  it('reports concurrent changes or deletions without replacing the product', async () => {
    send
      .mockResolvedValueOnce({ Items: [legacyProduct] })
      .mockRejectedValueOnce(
        Object.assign(new Error('Changed'), {
          name: 'ConditionalCheckFailedException',
        }),
      );

    expect(await backfillProductNames(client, 'products', false)).toMatchObject(
      { updated: 0, conflicts: 1 },
    );
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('propagates unexpected write failures', async () => {
    const error = new Error('DynamoDB unavailable');
    send
      .mockResolvedValueOnce({ Items: [legacyProduct] })
      .mockRejectedValueOnce(error);

    await expect(
      backfillProductNames(client, 'products', false),
    ).rejects.toThrow(error);
  });

  it.each([{ id: 'invalid' }, { id: 'invalid', name: ' ' }])(
    'refuses malformed source data before writing',
    async (item) => {
      send.mockResolvedValueOnce({ Items: [item] });

      await expect(
        backfillProductNames(client, 'products', false),
      ).rejects.toThrow('invalid product');
      expect(send).toHaveBeenCalledOnce();
    },
  );

  it('handles scan pages without items', async () => {
    send.mockResolvedValueOnce({});

    expect(await backfillProductNames(client, 'products', false)).toEqual({
      scanned: 0,
      needsUpdate: 0,
      updated: 0,
      conflicts: 0,
    });
  });
});
