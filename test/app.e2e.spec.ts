import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { UserRole } from '../src/shared/domain/enums/user-role.enum';
import { ProductStatus } from '../src/products/domain/enums/product-status.enum';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';

import * as argon2 from 'argon2';
import request from 'supertest';

import { AuthModule } from '../src/auth/auth.module';
import { ProductsModule } from '../src/products/products.module';
import { AUTH_USER_READER } from '../src/auth/application/ports/auth-user-reader.port';
import { USERS_WRITER } from '../src/users/application/ports/users-writer.port';
import { PRODUCTS_READER } from '../src/products/application/ports/products-reader.port';
import { PRODUCTS_WRITER } from '../src/products/application/ports/products-writer.port';
import { CommonModule } from '../src/common/common.module';
import { createSwaggerConfig } from '../src/config/swagger.config';

describe('API E2E', () => {
  let app: INestApplication;
  let passwordHash: string;

  const user = {
    id: 'user-123',
    email: 'admin@example.com',
    name: 'Admin',
    passwordHash: '',
    role: UserRole.ADMIN,
    createdAt: '2026-11-24T10:00:00.000Z',
  };

  const regularUser = {
    id: 'user-456',
    email: 'user@example.com',
    name: 'Regular User',
    passwordHash: '',
    role: UserRole.USER,
    createdAt: '2026-11-24T10:00:00.000Z',
  };

  const product = {
    id: 'product-1',
    name: 'Notebook',
    description: 'High performance notebook',
    priceInCents: 450000,
    status: ProductStatus.ACTIVE,
    createdAt: '2026-11-24T10:00:00.000Z',
    createdAtId: '2026-11-24T10:00:00.000Z#product-1',
    nameSort: 'notebook',
    nameSearch: 'notebook',
    priceSort: '000000000450000#product-1',
    descriptionSearch: 'high performance notebook',
  };

  const usersRepositoryMock = {
    findByEmail: vi.fn(),
    create: vi.fn(),
  };

  const productsRepositoryMock = {
    findAll: vi.fn(),
    create: vi.fn(),
  };

  beforeAll(async () => {
    passwordHash = await argon2.hash('correct-password');
    user.passwordHash = passwordHash;
    regularUser.passwordHash = passwordHash;

    usersRepositoryMock.findByEmail.mockImplementation(
      async (email: string) => {
        if (email === user.email) return user;
        if (email === regularUser.email) return regularUser;

        return null;
      },
    );
    usersRepositoryMock.create.mockResolvedValue(true);

    productsRepositoryMock.findAll.mockResolvedValue({
      items: [product],
      pagination: {
        pageSize: 20,
        nextCursor: null,
        hasNextPage: false,
      },
    });

    productsRepositoryMock.create.mockImplementation(async (params) => ({
      id: 'product-2',
      ...params,
      createdAtId: `${params.createdAt}#${params.id}`,
      nameSort: params.name.trim().toLowerCase(),
      nameSearch: params.name.trim().toLowerCase(),
      priceSort: `${String(params.priceInCents).padStart(15, '0')}#${params.id}`,
      descriptionSearch: params.description.trim().toLowerCase(),
    }));

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              NODE_ENV: 'test',
              AWS_REGION: 'us-east-1',
              DYNAMODB_USERS_TABLE: 'users',
              DYNAMODB_PRODUCTS_TABLE: 'products',
              REDIS_URL: 'redis://localhost:6379',
              JWT_SECRET: 'test-jwt-secret-with-at-least-32-characters',
              JWT_EXPIRES_IN: '15m',
              CURSOR_SECRET: 'test-cursor-secret-with-at-least-32-characters',
            }),
          ],
        }),
        AuthModule,
        ProductsModule,
        CommonModule,
      ],
    })
      .overrideProvider(AUTH_USER_READER)
      .useValue(usersRepositoryMock)
      .overrideProvider(USERS_WRITER)
      .useValue(usersRepositoryMock)
      .overrideProvider(PRODUCTS_READER)
      .useValue(productsRepositoryMock)
      .overrideProvider(PRODUCTS_WRITER)
      .useValue(productsRepositoryMock)
      .compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('v1');

    app.getHttpAdapter().getInstance().set('trust proxy', 'loopback');

    await app.init();
  });

  beforeEach(() => {
    productsRepositoryMock.create.mockClear();
    productsRepositoryMock.findAll.mockClear();
    usersRepositoryMock.findByEmail.mockClear();
    usersRepositoryMock.create.mockClear();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('documents the nullable cursor and the public error response', () => {
    const document = SwaggerModule.createDocument(app, createSwaggerConfig());

    expect(document.components?.schemas?.ProductsPaginationDto).toMatchObject({
      properties: {
        nextCursor: { type: 'string', nullable: true },
      },
      required: expect.arrayContaining(['nextCursor']),
    });
    expect(document.components?.schemas?.ApiErrorResponseDto).toMatchObject({
      properties: {
        statusCode: { type: 'number' },
        code: { type: 'string' },
        message: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
        path: { type: 'string' },
        requestId: { type: 'string' },
      },
      required: expect.arrayContaining([
        'statusCode',
        'code',
        'message',
        'timestamp',
        'path',
        'requestId',
      ]),
    });
  });

  describe('POST /v1/auth/login', () => {
    it('should authenticate a user and return an access token', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('X-Forwarded-For', '10.0.0.1')
        .send({
          email: 'admin@example.com',
          password: 'correct-password',
        })
        .expect(200);

      expect(response.body).toEqual({
        accessToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: 900,
      });

      expect(usersRepositoryMock.findByEmail).toHaveBeenCalledWith(
        'admin@example.com',
      );
    });

    it('should reject invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('X-Forwarded-For', '10.0.0.2')
        .send({
          email: 'admin@example.com',
          password: 'wrong-password',
        })
        .expect(401);
    });

    it('should reject an invalid email', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('X-Forwarded-For', '10.0.0.3')
        .send({
          email: 'invalid-email',
          password: 'correct-password',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: 'Validation failed',
        path: '/v1/auth/login',
        requestId: expect.any(String),
      });
      expect(usersRepositoryMock.findByEmail).not.toHaveBeenCalled();
      expect(JSON.stringify(response.body)).not.toContain('invalid-email');
      expect(JSON.stringify(response.body)).not.toContain('correct-password');
    });

    it('should enforce the login limit for the client IP resolved through a trusted proxy', async () => {
      const forwardedIp = `203.0.113.${Math.floor(Math.random() * 254) + 1}`;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await request(app.getHttpServer())
          .post('/v1/auth/login')
          .set('X-Forwarded-For', forwardedIp)
          .send({
            email: 'admin@example.com',
            password: 'correct-password',
          })
          .expect(200);
      }

      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('X-Forwarded-For', forwardedIp)
        .send({
          email: 'admin@example.com',
          password: 'correct-password',
        })
        .expect(429);
    });
  });

  describe('POST /v1/users', () => {
    it('registers a regular user without revealing account details', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/users')
        .send({
          name: 'New User',
          email: ' NEW@example.com ',
          password: 'secure-password',
        })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Registration request processed.',
      });
      expect(usersRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New User',
          email: 'new@example.com',
          role: UserRole.USER,
          passwordHash: expect.any(String),
        }),
      );
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('does not allow public registration to assign an administrative role', async () => {
      await request(app.getHttpServer())
        .post('/v1/users')
        .send({
          name: 'New Admin',
          email: 'new-admin@example.com',
          password: 'secure-password',
          role: UserRole.ADMIN,
        })
        .expect(400);

      expect(usersRepositoryMock.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /v1/products', () => {
    it('returns a unique request ID in the response header and error body', async () => {
      const firstResponse = await request(app.getHttpServer())
        .get('/v1/products')
        .expect(401);
      const secondResponse = await request(app.getHttpServer())
        .get('/v1/products')
        .expect(401);

      expect(firstResponse.headers['x-request-id']).toBe(
        firstResponse.body.requestId,
      );
      expect(secondResponse.headers['x-request-id']).toBe(
        secondResponse.body.requestId,
      );
      expect(firstResponse.body.requestId).not.toBe(
        secondResponse.body.requestId,
      );
    });

    it('should return products with a valid access token', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('X-Forwarded-For', '10.0.0.4')
        .send({
          email: 'admin@example.com',
          password: 'correct-password',
        })
        .expect(200);

      const accessToken = loginResponse.body.accessToken;

      const response = await request(app.getHttpServer())
        .get('/v1/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.items).toHaveLength(1);

      expect(response.body.items[0]).toEqual({
        id: product.id,
        name: product.name,
        description: product.description,
        priceInCents: product.priceInCents,
        status: product.status,
        createdAt: product.createdAt,
      });

      expect(response.body.pagination).toEqual({
        pageSize: 20,
        nextCursor: null,
        hasNextPage: false,
      });
    });

    it('should map the public search query to the application search term', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('X-Forwarded-For', '10.0.0.8')
        .send({ email: 'admin@example.com', password: 'correct-password' })
        .expect(200);

      await request(app.getHttpServer())
        .get('/v1/products?search=notebook')
        .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
        .expect(200);

      expect(productsRepositoryMock.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ searchTerm: 'notebook' }),
      );
    });

    it('should reject an invalid access token', async () => {
      await request(app.getHttpServer())
        .get('/v1/products')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should validate query parameters', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('X-Forwarded-For', '10.0.0.5')
        .send({
          email: 'admin@example.com',
          password: 'correct-password',
        })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/v1/products?pageSize=200')
        .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: 'Validation failed',
        path: '/v1/products',
        requestId: expect.any(String),
      });
      expect(productsRepositoryMock.findAll).not.toHaveBeenCalled();
    });

    it('keeps unexpected failures private and correlates their error logs', async () => {
      const error = Object.assign(
        new Error('password=private-db-password Bearer private-access-token'),
        {
          name: 'ProvisionedThroughputExceededException',
          $metadata: {
            httpStatusCode: 400,
            attempts: 3,
            requestId: 'private-sdk-metadata',
          },
        },
      );
      productsRepositoryMock.findAll.mockRejectedValueOnce(error);
      const token = await app.get(JwtService).signAsync({
        sub: regularUser.id,
        email: regularUser.email,
        role: UserRole.USER,
      });
      const stdout = vi
        .spyOn(process.stdout, 'write')
        .mockImplementation(() => true);

      try {
        const response = await request(app.getHttpServer())
          .get('/v1/products?search=private-query-token')
          .set('Authorization', `Bearer ${token}`)
          .expect(500);

        expect(response.body.message).toBe('Internal server error');
        expect(response.body).not.toHaveProperty('details');
        const output = stdout.mock.calls
          .map(([chunk]) => String(chunk))
          .join('');
        const record = JSON.parse(output.trim());
        expect(record).toMatchObject({
          level: 'error',
          context: 'HttpExceptionFilter',
          message: 'HTTP request failed (500 INTERNAL_SERVER_ERROR)',
          requestId: response.body.requestId,
        });
        expect(output).not.toContain('private-');
        expect(JSON.stringify(response.body)).not.toContain('private-');
      } finally {
        stdout.mockRestore();
      }
    });
  });

  describe('POST /v1/products', () => {
    const createProductBody = {
      name: 'Wireless Headphones',
      description: 'Wireless headphones with noise cancellation.',
      priceInCents: 59990,
    };

    it('should create a product with an admin access token', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('X-Forwarded-For', '10.0.0.6')
        .send({
          email: 'admin@example.com',
          password: 'correct-password',
        })
        .expect(200);

      const accessToken = loginResponse.body.accessToken;

      const response = await request(app.getHttpServer())
        .post('/v1/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createProductBody)
        .expect(201);

      expect(response.body).toEqual({
        id: expect.any(String),
        name: createProductBody.name,
        description: createProductBody.description,
        priceInCents: createProductBody.priceInCents,
        status: ProductStatus.ACTIVE,
        createdAt: expect.any(String),
      });

      expect(productsRepositoryMock.create).toHaveBeenCalledWith({
        ...createProductBody,
        id: expect.any(String),
        status: ProductStatus.ACTIVE,
        createdAt: expect.any(String),
      });
    });

    it('should reject product creation by a regular user', async () => {
      productsRepositoryMock.create.mockClear();

      const loginResponse = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('X-Forwarded-For', '10.0.0.7')
        .send({
          email: 'user@example.com',
          password: 'correct-password',
        })
        .expect(200);

      await request(app.getHttpServer())
        .post('/v1/products')
        .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
        .send(createProductBody)
        .expect(403);

      expect(productsRepositoryMock.create).not.toHaveBeenCalled();
    });

    it('should reject requests without an access token', async () => {
      await request(app.getHttpServer())
        .post('/v1/products')
        .send(createProductBody)
        .expect(401);
    });

    it('should reject invalid product data', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('X-Forwarded-For', '10.0.0.8')
        .send({
          email: 'admin@example.com',
          password: 'correct-password',
        })
        .expect(200);

      await request(app.getHttpServer())
        .post('/v1/products')
        .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
        .send({
          ...createProductBody,
          priceInCents: -100,
        })
        .expect(400);
    });

    it('should reject additional fields in the request body', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('X-Forwarded-For', '10.0.0.9')
        .send({
          email: 'admin@example.com',
          password: 'correct-password',
        })
        .expect(200);

      await request(app.getHttpServer())
        .post('/v1/products')
        .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
        .send({
          ...createProductBody,
          status: ProductStatus.INACTIVE,
          id: 'custom-id',
        })
        .expect(400);
    });
  });
});
