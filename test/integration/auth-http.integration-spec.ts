import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import * as argon2 from 'argon2';
import request from 'supertest';

import { AuthModule } from '@/auth/auth.module';
import { ProductsModule } from '@/products/products.module';
import { CommonModule } from '@/common/common.module';
import { DYNAMODB_DOCUMENT_CLIENT } from '@/database/dynamodb/dynamodb.constants';
import { UserRole } from '@/shared/domain/enums/user-role.enum';

describe('Authentication HTTP integration', () => {
  const usersTable = 'users-integration';
  const productsTable = 'products-integration';

  const email = 'auth-http-integration@example.com';
  const password = 'correct-password';
  const userId = 'auth-http-integration-user';

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
  let passwordHash: string;
  let jwtService: JwtService;

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
              DYNAMODB_USERS_TABLE: usersTable,
              DYNAMODB_PRODUCTS_TABLE: productsTable,
              REDIS_URL: 'redis://localhost:6379',
              JWT_SECRET: 'integration-test-jwt-secret-with-more-than-32-chars',
              JWT_EXPIRES_IN: '15m',
              CURSOR_SECRET:
                'integration-test-cursor-secret-with-more-than-32-chars',
            }),
          ],
        }),
        AuthModule,
        ProductsModule,
        CommonModule,
      ],
    })
      .overrideProvider(DYNAMODB_DOCUMENT_CLIENT)
      .useValue(documentClient)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.getHttpAdapter().getInstance().set('trust proxy', 'loopback');

    jwtService = app.get(JwtService);
    await app.init();
  });

  beforeEach(async () => {
    await documentClient.send(
      new DeleteCommand({
        TableName: usersTable,
        Key: { email },
      }),
    );

    await documentClient.send(
      new PutCommand({
        TableName: usersTable,
        Item: {
          id: userId,
          email,
          passwordHash,
          role: UserRole.USER,
        },
      }),
    );
  });

  afterAll(async () => {
    await documentClient.send(
      new DeleteCommand({
        TableName: usersTable,
        Key: { email },
      }),
    );

    await app.close();
    documentClient.destroy();
  });

  async function generateAccessToken(
    role: UserRole = UserRole.USER,
  ): Promise<string> {
    return jwtService.signAsync({
      sub: userId,
      email,
      role,
    });
  }

  describe('POST /v1/auth/login', () => {
    it('should authenticate with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email, password })
        .expect(200);

      expect(response.body).toMatchObject({
        accessToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: 900,
      });
    });

    it('should reject an incorrect password', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email,
          password: 'wrong-password',
        })
        .expect(401);
    });

    it('should reject a non-existent user', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'unknown@example.com',
          password,
        })
        .expect(401);
    });

    it('should reject an invalid request body', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'invalid-email',
          password,
        })
        .expect(400);
    });
  });

  describe('GET /v1/products', () => {
    it('should reject requests without an access token', async () => {
      await request(app.getHttpServer()).get('/v1/products').expect(401);
    });

    it('should reject an invalid access token', async () => {
      await request(app.getHttpServer())
        .get('/v1/products')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should accept a valid access token', async () => {
      const token = await generateAccessToken();

      await request(app.getHttpServer())
        .get('/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });
});
