import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import * as argon2 from 'argon2';

import { AuthModule } from '../../src/auth/auth.module';
import { AuthService } from '../../src/auth/application/login/auth.service';
import { DYNAMODB_DOCUMENT_CLIENT } from '../../src/database/dynamodb/dynamodb.constants';
import { UserRole } from '../../src/shared/domain/enums/user-role.enum';

describe('Auth integration', () => {
  const tableName = 'users-integration';

  const email = 'auth-integration@example.com';
  const password = 'correct-password';

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

  let app: INestApplication;
  let authService: AuthService;
  let jwtService: JwtService;
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await argon2.hash(password);

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              NODE_ENV: 'test',
              AWS_REGION: process.env.AWS_REGION ?? 'us-east-1',
              DYNAMODB_ENDPOINT:
                process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000',
              DYNAMODB_USERS_TABLE: tableName,
              DYNAMODB_PRODUCTS_TABLE: 'products-integration',
              REDIS_URL: 'redis://localhost:6379',
              JWT_SECRET: 'integration-test-jwt-secret-with-more-than-32-chars',
              JWT_EXPIRES_IN: '15m',
              CURSOR_SECRET:
                'integration-test-cursor-secret-with-more-than-32-chars',
            }),
          ],
        }),
        AuthModule,
      ],
    })
      .overrideProvider(DYNAMODB_DOCUMENT_CLIENT)
      .useValue(documentClient)
      .compile();

    app = moduleRef.createNestApplication();

    await app.init();

    authService = app.get(AuthService);
    jwtService = app.get(JwtService);
  });

  beforeEach(async () => {
    await documentClient.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { email },
      }),
    );
  });

  afterAll(async () => {
    await documentClient.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { email },
      }),
    );

    await app.close();
    documentClient.destroy();
  });

  async function insertUser(role: UserRole = UserRole.USER) {
    await documentClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          id: 'auth-integration-user-id',
          email,
          passwordHash,
          role,
        },
      }),
    );
  }

  describe('login', () => {
    it('should authenticate a user and return a valid JWT', async () => {
      await insertUser();

      const result = await authService.login({
        email,
        password,
      });

      expect(result).toEqual({
        accessToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: 900,
      });

      const payload = await jwtService.verifyAsync(result.accessToken);

      expect(payload).toMatchObject({
        sub: 'auth-integration-user-id',
        email,
        role: UserRole.USER,
      });

      expect(payload.exp).toEqual(expect.any(Number));
      expect(payload.iat).toEqual(expect.any(Number));
    });

    it('should normalize the email before searching', async () => {
      await insertUser();

      const result = await authService.login({
        email: `  ${email.toUpperCase()}  `,
        password,
      });

      expect(result.accessToken).toEqual(expect.any(String));
    });

    it('should reject an incorrect password', async () => {
      await insertUser();

      await expect(
        authService.login({
          email,
          password: 'wrong-password',
        }),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject a non-existent user', async () => {
      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password,
        }),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should include the ADMIN role in the JWT payload', async () => {
      await insertUser(UserRole.ADMIN);

      const result = await authService.login({
        email,
        password,
      });

      const payload = await jwtService.verifyAsync(result.accessToken);

      expect(payload.role).toBe(UserRole.ADMIN);
    });
  });
});
