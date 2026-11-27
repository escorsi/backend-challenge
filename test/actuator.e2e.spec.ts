import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ActuatorModule } from '../src/actuator/actuator.module';

describe('Actuator endpoints', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
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
              METRICS_BEARER_TOKEN:
                'test-metrics-bearer-token-with-at-least-32-characters',
            }),
          ],
        }),
        ActuatorModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns process liveness from the health endpoint', async () => {
    await request(app.getHttpServer())
      .get('/v1/actuator/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: 'ok',
          info: {},
          error: {},
          details: {},
        });
      });
  });

  it('exposes Prometheus process and HTTP metrics', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/actuator/prometheus')
      .set(
        'Authorization',
        'Bearer test-metrics-bearer-token-with-at-least-32-characters',
      )
      .expect(200)
      .expect('Content-Type', /text\/plain/);

    expect(response.text).toContain(
      '# HELP ton_backend_process_start_time_seconds',
    );
    expect(response.text).toContain('# HELP http_requests_total');
    expect(response.text).toMatch(
      /http_requests_total\{method="GET",route="[^"]*actuator\/health",status_code="200"\} 1/,
    );
  });
});
