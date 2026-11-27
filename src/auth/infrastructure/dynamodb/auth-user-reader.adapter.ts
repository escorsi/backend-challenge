import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

import type {
  AuthUserReader,
  AuthUserRecord,
} from '../../application/ports/auth-user-reader.port';
import { DYNAMODB_DOCUMENT_CLIENT } from '../../../database/dynamodb/dynamodb.constants';

@Injectable()
export class AuthUserReaderAdapter implements AuthUserReader {
  private readonly tableName: string;

  constructor(
    @Inject(DYNAMODB_DOCUMENT_CLIENT)
    private readonly documentClient: DynamoDBDocumentClient,
    configService: ConfigService,
  ) {
    this.tableName = configService.getOrThrow<string>('DYNAMODB_USERS_TABLE');
  }

  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const result = await this.documentClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { email },
      }),
    );

    return (result.Item as AuthUserRecord | undefined) ?? null;
  }
}
