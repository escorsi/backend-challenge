import { z } from 'zod';
import { MAX_PRODUCT_PRICE_IN_CENTS } from '@/products/domain/constants/product-pricing.constants';

export const createProductSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(500),
    priceInCents: z.number().int().min(1).max(MAX_PRODUCT_PRICE_IN_CENTS),
  })
  .strict();

export type CreateProductDto = z.infer<typeof createProductSchema>;
