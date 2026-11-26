import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';

async function main() {
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    endpoint: process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000',
    credentials: {
      accessKeyId: 'local',
      secretAccessKey: 'local',
    },
    maxAttempts: 1,
  });

  try {
    console.log('Checking DynamoDB connection...');

    const response = await client.send(new ListTablesCommand({}), {
      abortSignal: AbortSignal.timeout(5000),
    });

    console.log('DynamoDB connected successfully!');
    console.log('Tables:', response.TableNames ?? []);
  } catch (error) {
    console.error('DynamoDB connection failed:', error);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
}

main();
