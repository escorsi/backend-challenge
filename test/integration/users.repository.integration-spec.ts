import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '@nestjs/config';

import { UsersRepository } from '../../src/users/infrastructure/dynamodb/users.repository';
import { UserRole } from '../../src/shared/domain/enums/user-role.enum';

import type { User } from '../../src/users/domain/models/user.interface';

describe('UsersRepository integration', () => {
  const tableName = 'users-integration';

  const client = new DynamoDBClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    endpoint: process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000',
    credentials: {
      accessKeyId: 'local',
      secretAccessKey: 'local',
    },
  });

  const documentClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  });

  const configService = {
    getOrThrow: () => tableName,
  } as unknown as ConfigService;

  const repository = new UsersRepository(documentClient, configService);

  const user: User = {
    id: '1',
    email: 'integration@example.com',
    name: 'Integration User',
    passwordHash: 'hashed-password',
    role: UserRole.USER,
    createdAt: '2026-11-24T10:00:00.000Z',
  };

  beforeEach(async () => {
    await documentClient.send(
      new DeleteCommand({
        TableName: tableName,
        Key: {
          email: user.email,
        },
      }),
    );
  });

  afterAll(async () => {
    await documentClient.send(
      new DeleteCommand({
        TableName: tableName,
        Key: {
          email: user.email,
        },
      }),
    );

    documentClient.destroy();
  });

  describe('findByEmail', () => {
    it('should return an existing user', async () => {
      await documentClient.send(
        new PutCommand({
          TableName: tableName,
          Item: user,
        }),
      );

      const result = await repository.findByEmail(user.email);

      expect(result).toEqual(user);
    });

    it('should return null when the user does not exist', async () => {
      const result = await repository.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });

    it('should return null when searching for a different email', async () => {
      await documentClient.send(
        new PutCommand({
          TableName: tableName,
          Item: user,
        }),
      );

      const result = await repository.findByEmail('another@example.com');

      expect(result).toBeNull();
    });
  });
});
