import { describe, expect, it } from 'vitest';

import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const requiredSecrets = {
    JWT_SECRET: 'a-jwt-secret-with-at-least-32-characters',
    CURSOR_SECRET: 'a-cursor-secret-with-at-least-32-characters',
  };

  it('applies defaults when optional environment variables are omitted', () => {
    expect(validateEnv(requiredSecrets)).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      AWS_REGION: 'us-east-1',
      DYNAMODB_USERS_TABLE: 'users',
      DYNAMODB_PRODUCTS_TABLE: 'products',
      REDIS_URL: 'redis://localhost:6379',
      TRUSTED_PROXY_CIDRS: '',
      JWT_EXPIRES_IN: '15m',
    });
  });

  it('coerces and preserves valid deployment configuration', () => {
    expect(
      validateEnv({
        ...requiredSecrets,
        NODE_ENV: 'production',
        PORT: '8080',
        AWS_REGION: 'us-west-2',
        DYNAMODB_ENDPOINT: 'http://localhost:8000',
        REDIS_URL: 'redis://cache.internal:6379',
        TRUSTED_PROXY_CIDRS: '10.0.0.0/8, 192.168.0.0/16',
        METRICS_BEARER_TOKEN: 'a-metrics-token-with-at-least-32-characters',
        JWT_EXPIRES_IN: '30m',
      }),
    ).toMatchObject({
      NODE_ENV: 'production',
      PORT: 8080,
      AWS_REGION: 'us-west-2',
      DYNAMODB_ENDPOINT: 'http://localhost:8000',
      REDIS_URL: 'redis://cache.internal:6379',
      TRUSTED_PROXY_CIDRS: '10.0.0.0/8, 192.168.0.0/16',
      METRICS_BEARER_TOKEN: 'a-metrics-token-with-at-least-32-characters',
      JWT_EXPIRES_IN: '30m',
    });
  });

  it('rejects missing or weak secrets and invalid environment values', () => {
    expect(() => validateEnv({})).toThrow();
    expect(() =>
      validateEnv({
        ...requiredSecrets,
        JWT_SECRET: 'too-short',
      }),
    ).toThrow();
    expect(() =>
      validateEnv({
        ...requiredSecrets,
        NODE_ENV: 'staging',
      }),
    ).toThrow();
    expect(() =>
      validateEnv({
        ...requiredSecrets,
        REDIS_URL: 'not-a-url',
      }),
    ).toThrow();
  });

  it('requires a metrics bearer token in production', () => {
    expect(() =>
      validateEnv({ ...requiredSecrets, NODE_ENV: 'production' }),
    ).toThrow();
  });
});
