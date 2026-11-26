import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  PORT: z.coerce.number().int().positive().default(3000),

  AWS_REGION: z.string().default('us-east-1'),
  DYNAMODB_ENDPOINT: z.url().optional(),
  DYNAMODB_PRODUCTS_TABLE: z.string().default('products'),
  
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),

  CURSOR_SECRET: z.string().min(32),
});

export function validateEnv(config: Record<string, unknown>) {
  return envSchema.parse(config);
}
