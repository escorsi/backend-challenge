import { Inject, Injectable } from '@nestjs/common';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '@nestjs/config';

import { DYNAMODB_DOCUMENT_CLIENT } from '../../../database/dynamodb/dynamodb.constants';
import type { User } from '../../domain/models/user.interface';
import type { UsersWriter } from '../../application/ports/users-writer.port';
import type { AuthUserReader } from '../../../auth/application/ports/auth-user-reader.port';

@Injectable()
export class UsersRepository implements AuthUserReader, UsersWriter {
  private readonly tableName: string;

  constructor(
    @Inject(DYNAMODB_DOCUMENT_CLIENT)
    private readonly documentClient: DynamoDBDocumentClient,
    private readonly configService: ConfigService,
  ) {
    this.tableName = this.configService.getOrThrow<string>(
      'DYNAMODB_USERS_TABLE',
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.documentClient.send(
      new GetCommand({
        TableName: this.tableName,
        ConsistentRead: true,
        Key: {
          email,
        },
      }),
    );

    return (result.Item as User | undefined) ?? null;
  }

  async create(user: User): Promise<void> {
    try {
      await this.documentClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: user,
          ConditionExpression: 'attribute_not_exists(#email)',
          ExpressionAttributeNames: { '#email': 'email' },
        }),
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === 'ConditionalCheckFailedException'
      ) {
        return;
      }
      throw error;
    }
  }
}
