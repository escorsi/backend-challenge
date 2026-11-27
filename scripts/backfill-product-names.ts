import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { backfillProductNames } from '../src/products/infrastructure/dynamodb/migrations/backfill-product-names';

const integration = process.argv.includes('--integration');
const dryRun = !process.argv.includes('--apply');
const endpoint = integration
  ? (process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000')
  : process.env.DYNAMODB_ENDPOINT;
const tableName = integration
  ? 'products-integration'
  : (process.env.DYNAMODB_PRODUCTS_TABLE ?? 'products');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
  maxAttempts: 3,
  ...(endpoint && {
    endpoint,
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  }),
});
const documentClient = DynamoDBDocumentClient.from(client);

async function main(): Promise<void> {
  console.log(`Product names backfill: table=${tableName}, dryRun=${dryRun}`);
  const result = await backfillProductNames(documentClient, tableName, dryRun);
  console.log(JSON.stringify(result));

  if (result.conflicts > 0) {
    throw new Error(
      'Products changed during the backfill. Rerun it to complete the migration.',
    );
  }
  if (dryRun) {
    console.log(
      'Preview only. Pass --apply to update the derived name attributes.',
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error('Product names backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(() => documentClient.destroy());
