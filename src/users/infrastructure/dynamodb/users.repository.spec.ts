import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '@nestjs/config';

import { UserRole } from '../../../shared/domain/enums/user-role.enum';
import type { User } from '../../domain/models/user.interface';
import { UsersRepository } from './users.repository';

describe('UsersRepository', () => {
  let repository: UsersRepository;
  let documentClient: DynamoDBDocumentClient;

  const user: User = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    passwordHash: 'hash',
    role: UserRole.USER,
    createdAt: '2026-11-26T00:00:00.000Z',
  };

  beforeEach(() => {
    documentClient = { send: vi.fn() } as unknown as DynamoDBDocumentClient;
    repository = new UsersRepository(documentClient, {
      getOrThrow: () => 'users',
    } as unknown as ConfigService);
  });

  it('reads by normalized primary key with strong consistency', async () => {
    vi.mocked(documentClient.send).mockResolvedValueOnce({
      Item: user,
    } as never);

    await expect(repository.findByEmail(user.email)).resolves.toEqual(user);

    const command = vi.mocked(documentClient.send).mock
      .calls[0][0] as GetCommand;
    expect(command).toBeInstanceOf(GetCommand);
    expect(command.input).toEqual({
      TableName: 'users',
      ConsistentRead: true,
      Key: { email: user.email },
    });
  });

  it('returns null when the user does not exist', async () => {
    vi.mocked(documentClient.send).mockResolvedValueOnce({} as never);

    await expect(repository.findByEmail(user.email)).resolves.toBeNull();
  });

  it('uses a conditional put and ignores duplicate email without overwriting', async () => {
    const commandError = Object.assign(new Error('conditional check failed'), {
      name: 'ConditionalCheckFailedException',
    });
    vi.mocked(documentClient.send).mockRejectedValueOnce(commandError);

    await expect(repository.create(user)).resolves.toBeUndefined();

    const command = vi.mocked(documentClient.send).mock
      .calls[0][0] as PutCommand;
    expect(command).toBeInstanceOf(PutCommand);
    expect(command.input).toMatchObject({
      TableName: 'users',
      Item: user,
      ConditionExpression: 'attribute_not_exists(#email)',
      ExpressionAttributeNames: { '#email': 'email' },
    });
  });

  it('propagates unexpected DynamoDB errors', async () => {
    const error = new Error('DynamoDB unavailable');
    vi.mocked(documentClient.send).mockRejectedValueOnce(error);

    await expect(repository.findByEmail(user.email)).rejects.toThrow(error);
  });
});
