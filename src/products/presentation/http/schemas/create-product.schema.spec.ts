import { describe, expect, it } from 'vitest';

import { MAX_PRODUCT_PRICE_IN_CENTS } from '../../../domain/constants/product-pricing.constants';
import { createProductSchema } from './create-product.schema';

describe('createProductSchema', () => {
  const validProduct = {
    name: 'Wireless Headphones',
    description: 'Noise-cancelling headphones',
    priceInCents: 59990,
  };

  it('accepts product details with a safe integer price', () => {
    expect(createProductSchema.parse(validProduct)).toEqual(validProduct);
  });

  it('rejects prices above the range supported by the sort key', () => {
    expect(
      createProductSchema.safeParse({
        ...validProduct,
        priceInCents: MAX_PRODUCT_PRICE_IN_CENTS + 1,
      }).success,
    ).toBe(false);
  });

  it('does not allow clients to assign product status', () => {
    expect(
      createProductSchema.safeParse({
        ...validProduct,
        status: 'INACTIVE',
      }).success,
    ).toBe(false);
  });
});
