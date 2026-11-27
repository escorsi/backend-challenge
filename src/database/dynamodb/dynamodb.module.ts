import { Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import {
  DYNAMODB_CLIENT,
  DYNAMODB_DOCUMENT_CLIENT,
} from './dynamodb.constants';

@Injectable()
class DynamoDBConnection implements OnApplicationShutdown {
  readonly client: DynamoDBClient;
  readonly documentClient: DynamoDBDocumentClient;

  constructor(configService: ConfigService) {
    const endpoint = configService.get<string>('DYNAMODB_ENDPOINT');
    this.client = new DynamoDBClient({
      region: configService.getOrThrow<string>('AWS_REGION'),
      maxAttempts: 3,
      ...(endpoint && {
        endpoint,
        credentials: {
          accessKeyId: 'local',
          secretAccessKey: 'local',
        },
      }),
    });

    this.documentClient = DynamoDBDocumentClient.from(this.client, {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    });
  }

  onApplicationShutdown(): void {
    this.client.destroy();
  }
}

@Module({
  providers: [
    DynamoDBConnection,
    {
      provide: DYNAMODB_CLIENT,
      inject: [DynamoDBConnection],
      useFactory: (connection: DynamoDBConnection) => connection.client,
    },
    {
      provide: DYNAMODB_DOCUMENT_CLIENT,
      inject: [DynamoDBConnection],
      useFactory: (connection: DynamoDBConnection) => connection.documentClient,
    },
  ],
  exports: [DYNAMODB_CLIENT, DYNAMODB_DOCUMENT_CLIENT],
})
export class DynamoDBModule {}
