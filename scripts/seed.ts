import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import * as argon2 from 'argon2';

import { UserRole } from '@/shared/domain/enums/user-role.enum';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import { toProductItem } from '@/products/infrastructure/dynamodb/mappers/product-item.mapper';

const region = process.env.AWS_REGION ?? 'us-east-1';
const endpoint = process.env.DYNAMODB_ENDPOINT;

const usersTable = process.env.DYNAMODB_USERS_TABLE ?? 'users';
const productsTable = process.env.DYNAMODB_PRODUCTS_TABLE ?? 'products';

const email = process.env.SEED_USER_EMAIL?.trim().toLowerCase();
const password = process.env.SEED_USER_PASSWORD;

if (process.env.NODE_ENV === 'production') {
  throw new Error('The sample seed script cannot run in production.');
}

if (!email || !password) {
  throw new Error('SEED_USER_EMAIL and SEED_USER_PASSWORD must be configured.');
}

const client = new DynamoDBClient({
  region,
  ...(endpoint && {
    endpoint,
    credentials: {
      accessKeyId: 'local',
      secretAccessKey: 'local',
    },
  }),
});

const documentClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

async function putIfNotExists(
  tableName: string,
  key: string,
  item: object,
): Promise<void> {
  try {
    await documentClient.send(
      new PutCommand({
        TableName: tableName,
        Item: { ...item },
        ConditionExpression: 'attribute_not_exists(#key)',
        ExpressionAttributeNames: {
          '#key': key,
        },
      }),
    );

    console.log(`Created record in "${tableName}".`);
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === 'ConditionalCheckFailedException'
    ) {
      console.log(`Record already exists in "${tableName}".`);
      return;
    }

    throw error;
  }
}

async function seedUser(): Promise<void> {
  const password = process.env.SEED_USER_PASSWORD;

  if (!password) {
    throw new Error('SEED_USER_PASSWORD environment variable is required');
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
  });

  await putIfNotExists(usersTable, 'email', {
    email,
    id: randomUUID(),
    name: 'Administrator',
    passwordHash,
    role: UserRole.ADMIN,
    createdAt: new Date().toISOString(),
  });
}

async function seedProducts(): Promise<void> {
  const products = [
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Wireless Headphones',
      description: 'Wireless headphones with noise cancellation.',
      priceInCents: 59990,
      status: ProductStatus.ACTIVE,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Mechanical Keyboard',
      description: 'Mechanical keyboard with RGB backlighting.',
      priceInCents: 34990,
      status: ProductStatus.ACTIVE,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      name: 'Gaming Mouse',
      description: 'Ergonomic gaming mouse with adjustable DPI.',
      priceInCents: 19990,
      status: ProductStatus.ACTIVE,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440004',
      name: 'USB Hub',
      description: 'USB-C hub with multiple connectivity ports.',
      priceInCents: 12990,
      status: ProductStatus.INACTIVE,
    },
  ];

  for (const product of products) {
    const createdAt = new Date().toISOString();

    await putIfNotExists(
      productsTable,
      'id',
      toProductItem({
        ...product,
        createdAt,
      }),
    );
  }
}

async function main(): Promise<void> {
  console.log('Starting database seed...');

  await seedUser();
  await seedProducts();

  console.log('Database seed completed successfully.');
}

main()
  .catch((error: unknown) => {
    console.error('Database seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    documentClient.destroy();
  });
