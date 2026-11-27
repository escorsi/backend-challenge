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
        REDIS_URL: 'rediss://cache.internal:6379',
        TRUSTED_PROXY_CIDRS: '10.0.0.0/8, 192.168.0.0/16',
        METRICS_BEARER_TOKEN: 'a-metrics-token-with-at-least-32-characters',
        JWT_EXPIRES_IN: '30m',
      }),
    ).toMatchObject({
      NODE_ENV: 'production',
      PORT: 8080,
      AWS_REGION: 'us-west-2',
      REDIS_URL: 'rediss://cache.internal:6379',
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

  it.each(['1s', '15m', '2h', '1d', '1w'])(
    'accepts an explicit positive JWT duration: %s',
    (duration) => {
      expect(
        validateEnv({ ...requiredSecrets, JWT_EXPIRES_IN: duration }),
      ).toHaveProperty('JWT_EXPIRES_IN', duration);
    },
  );

  it.each([
    '',
    'banana',
    '0',
    '0s',
    '-1s',
    '120',
    '1ms',
    '0.5s',
    '1e3s',
    '9007199254740992w',
  ])('rejects an invalid JWT duration at startup: %s', (duration) => {
    expect(() =>
      validateEnv({ ...requiredSecrets, JWT_EXPIRES_IN: duration }),
    ).toThrow('JWT_EXPIRES_IN');
  });

  it('requires a metrics bearer token in production', () => {
    expect(() =>
      validateEnv({
        ...requiredSecrets,
        NODE_ENV: 'production',
        REDIS_URL: 'redis://cache.internal:6379',
      }),
    ).toThrow();
  });

  it('requires Redis to be explicitly configured in production', () => {
    expect(() =>
      validateEnv({
        ...requiredSecrets,
        NODE_ENV: 'production',
        METRICS_BEARER_TOKEN: 'a-metrics-token-with-at-least-32-characters',
      }),
    ).toThrow('REDIS_URL is required in production');
  });

  it('rejects local infrastructure endpoints and example secrets in production', () => {
    const productionConfig = {
      NODE_ENV: 'production',
      REDIS_URL: 'redis://cache.internal:6379',
      METRICS_BEARER_TOKEN: 'a-metrics-token-with-at-least-32-characters',
      ...requiredSecrets,
    };

    expect(() =>
      validateEnv({
        ...productionConfig,
        REDIS_URL: 'redis://localhost:6379',
      }),
    ).toThrow('REDIS_URL must not point to localhost in production');

    expect(() =>
      validateEnv({
        ...productionConfig,
        REDIS_URL: 'redis://cache.internal:6379',
      }),
    ).toThrow('REDIS_URL must use TLS (rediss://) in production');

    expect(() =>
      validateEnv({
        ...productionConfig,
        DYNAMODB_ENDPOINT: 'http://localhost:8000',
      }),
    ).toThrow('DYNAMODB_ENDPOINT must not be configured in production');

    expect(() =>
      validateEnv({
        ...productionConfig,
        JWT_SECRET: 'local-development-jwt-secret-change-me-123456',
      }),
    ).toThrow('JWT_SECRET must be replaced with a production secret');

    expect(() =>
      validateEnv({
        ...productionConfig,
        CURSOR_SECRET: 'local-development-cursor-secret-change-me-123456',
      }),
    ).toThrow('CURSOR_SECRET must be replaced with a production secret');
  });
});
