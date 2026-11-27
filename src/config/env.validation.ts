import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),

    PORT: z.coerce.number().int().positive().default(3000),
    REDIS_URL: z.url({ protocol: /^rediss?$/ }).optional(),
    TRUSTED_PROXY_CIDRS: z.string().default(''),
    METRICS_BEARER_TOKEN: z.string().min(32).optional(),

    AWS_REGION: z.string().default('us-east-1'),
    DYNAMODB_ENDPOINT: z.url().optional(),
    DYNAMODB_USERS_TABLE: z.string().default('users'),
    DYNAMODB_PRODUCTS_TABLE: z.string().default('products'),
    SEED_USER_EMAIL: z.email().optional(),
    SEED_USER_PASSWORD: z.string().optional(),

    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().default('15m'),

    CURSOR_SECRET: z.string().min(32),
  })
  .superRefine((config, context) => {
    let redisHostname = '';

    if (config.REDIS_URL) {
      try {
        redisHostname = new URL(config.REDIS_URL).hostname.toLowerCase();
      } catch {
        return;
      }
    }

    if (config.NODE_ENV === 'production' && !config.REDIS_URL) {
      context.addIssue({
        code: 'custom',
        path: ['REDIS_URL'],
        message: 'REDIS_URL is required in production',
      });
    }

    if (config.NODE_ENV === 'production' && !config.METRICS_BEARER_TOKEN) {
      context.addIssue({
        code: 'custom',
        path: ['METRICS_BEARER_TOKEN'],
        message: 'METRICS_BEARER_TOKEN is required in production',
      });
    }

    if (
      config.NODE_ENV === 'production' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(redisHostname)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['REDIS_URL'],
        message: 'REDIS_URL must not point to localhost in production',
      });
    }

    if (
      config.NODE_ENV === 'production' &&
      config.REDIS_URL &&
      !config.REDIS_URL.startsWith('rediss://')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['REDIS_URL'],
        message: 'REDIS_URL must use TLS (rediss://) in production',
      });
    }

    if (config.NODE_ENV === 'production' && config.DYNAMODB_ENDPOINT) {
      context.addIssue({
        code: 'custom',
        path: ['DYNAMODB_ENDPOINT'],
        message: 'DYNAMODB_ENDPOINT must not be configured in production',
      });
    }

    if (
      config.NODE_ENV === 'production' &&
      config.JWT_SECRET === 'local-development-jwt-secret-change-me-123456'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be replaced with a production secret',
      });
    }

    if (
      config.NODE_ENV === 'production' &&
      config.CURSOR_SECRET ===
        'local-development-cursor-secret-change-me-123456'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['CURSOR_SECRET'],
        message: 'CURSOR_SECRET must be replaced with a production secret',
      });
    }
  });

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = envSchema.parse(config);

  return {
    ...validatedConfig,
    REDIS_URL: validatedConfig.REDIS_URL ?? 'redis://localhost:6379',
  };
}
