import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

import { toProductNameAttributes } from '../mappers/product-item.mapper';

export interface ProductNamesBackfillResult {
  scanned: number;
  needsUpdate: number;
  updated: number;
  conflicts: number;
}

export async function backfillProductNames(
  documentClient: DynamoDBDocumentClient,
  tableName: string,
  dryRun = true,
): Promise<ProductNamesBackfillResult> {
  const result = { scanned: 0, needsUpdate: 0, updated: 0, conflicts: 0 };
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const page = await documentClient.send(
      new ScanCommand({
        TableName: tableName,
        ConsistentRead: true,
        Limit: 100,
        ExclusiveStartKey: exclusiveStartKey,
        ProjectionExpression: '#id, #name, #nameSort, #nameSearch',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#name': 'name',
          '#nameSort': 'nameSort',
          '#nameSearch': 'nameSearch',
        },
      }),
    );

    for (const item of page.Items ?? []) {
      result.scanned += 1;
      if (
        typeof item.id !== 'string' ||
        typeof item.name !== 'string' ||
        item.name.trim().length === 0
      ) {
        throw new Error(
          'Product names backfill encountered an invalid product',
        );
      }

      const attributes = toProductNameAttributes(item.name);
      if (
        item.nameSort === attributes.nameSort &&
        item.nameSearch === attributes.nameSearch
      ) {
        continue;
      }

      result.needsUpdate += 1;
      if (dryRun) {
        continue;
      }

      try {
        await documentClient.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { id: item.id },
            UpdateExpression:
              'SET #nameSort = :nameSort, #nameSearch = :nameSearch',
            ConditionExpression: 'attribute_exists(#id) AND #name = :name',
            ExpressionAttributeNames: {
              '#id': 'id',
              '#name': 'name',
              '#nameSort': 'nameSort',
              '#nameSearch': 'nameSearch',
            },
            ExpressionAttributeValues: {
              ':name': item.name,
              ':nameSort': attributes.nameSort,
              ':nameSearch': attributes.nameSearch,
            },
          }),
        );
        result.updated += 1;
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === 'ConditionalCheckFailedException'
        ) {
          result.conflicts += 1;
          continue;
        }
        throw error;
      }
    }

    exclusiveStartKey = page.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return result;
}
