import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceNotFoundException,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { PRODUCT_INDEXES } from '@/products/infrastructure/dynamodb/constants/product-indexes.constants';

const region = process.env.AWS_REGION ?? 'us-east-1';
const integration = process.argv.includes('--integration');
const endpoint = integration
  ? (process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000')
  : process.env.DYNAMODB_ENDPOINT;

const client = new DynamoDBClient({
  region,
  ...(endpoint && {
    endpoint,
    credentials: {
      accessKeyId: 'local',
      secretAccessKey: 'local',
    },
  }),
  maxAttempts: 3,
});

function normalizeKeySchema(
  keySchema: Array<{ AttributeName?: string; KeyType?: string }> = [],
): string {
  return keySchema
    .map(({ AttributeName, KeyType }) => `${KeyType}:${AttributeName}`)
    .sort()
    .join('|');
}

async function waitForTableAndIndexesActive(tableName: string): Promise<void> {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    const { Table } = await client.send(
      new DescribeTableCommand({ TableName: tableName }),
    );
    const tableIsActive = Table?.TableStatus === 'ACTIVE';
    const indexesAreActive = (Table?.GlobalSecondaryIndexes ?? []).every(
      (index) => index.IndexStatus === 'ACTIVE',
    );

    if (tableIsActive && indexesAreActive) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Table "${tableName}" and its indexes did not become active within 30 seconds.`,
  );
}

async function createTable(
  tableName: string,
  input: Omit<ConstructorParameters<typeof CreateTableCommand>[0], 'TableName'>,
): Promise<void> {
  try {
    const { Table } = await client.send(
      new DescribeTableCommand({
        TableName: tableName,
      }),
    );

    if (
      normalizeKeySchema(Table?.KeySchema) !==
      normalizeKeySchema(input.KeySchema)
    ) {
      throw new Error(
        `Table "${tableName}" has a different primary key schema.`,
      );
    }

    const existingIndexes = Table?.GlobalSecondaryIndexes ?? [];
    for (const requiredIndex of input.GlobalSecondaryIndexes ?? []) {
      const existingIndex = existingIndexes.find(
        ({ IndexName }) => IndexName === requiredIndex.IndexName,
      );

      if (
        !existingIndex ||
        normalizeKeySchema(existingIndex.KeySchema) !==
          normalizeKeySchema(requiredIndex.KeySchema) ||
        existingIndex.Projection?.ProjectionType !==
          requiredIndex.Projection?.ProjectionType
      ) {
        throw new Error(
          `Table "${tableName}" is missing or has an incompatible index "${requiredIndex.IndexName}". Apply a schema migration before continuing.`,
        );
      }
    }

    console.log(`Table "${tableName}" already exists.`);
    await waitForTableAndIndexesActive(tableName);
    return;
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) {
      throw error;
    }
  }

  console.log(`Creating table "${tableName}"...`);

  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      BillingMode: 'PAY_PER_REQUEST',
      ...input,
    }),
  );

  await waitUntilTableExists(
    {
      client,
      maxWaitTime: 30,
    },
    {
      TableName: tableName,
    },
  );
  await waitForTableAndIndexesActive(tableName);

  console.log(`Table "${tableName}" created successfully.`);
}

async function main(): Promise<void> {
  const usersTable = integration
    ? 'users-integration'
    : (process.env.DYNAMODB_USERS_TABLE ?? 'users');
  const productsTable = integration
    ? 'products-integration'
    : (process.env.DYNAMODB_PRODUCTS_TABLE ?? 'products');

  await createTable(usersTable, {
    AttributeDefinitions: [
      {
        AttributeName: 'email',
        AttributeType: 'S',
      },
    ],
    KeySchema: [
      {
        AttributeName: 'email',
        KeyType: 'HASH',
      },
    ],
  });

  await createTable(productsTable, {
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'status', AttributeType: 'S' },
      ...Object.values(PRODUCT_INDEXES).map(({ sortKey }) => ({
        AttributeName: sortKey,
        AttributeType: 'S' as const,
      })),
    ],
    KeySchema: [
      {
        AttributeName: 'id',
        KeyType: 'HASH',
      },
    ],
    GlobalSecondaryIndexes: Object.values(PRODUCT_INDEXES).map(
      ({ indexName, sortKey }) => ({
        IndexName: indexName,
        KeySchema: [
          { AttributeName: 'status', KeyType: 'HASH' as const },
          { AttributeName: sortKey, KeyType: 'RANGE' as const },
        ],
        Projection: { ProjectionType: 'ALL' as const },
      }),
    ),
  });

  console.log('\nDynamoDB setup completed.');
}

main()
  .catch((error: unknown) => {
    console.error('DynamoDB setup failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    client.destroy();
  });
