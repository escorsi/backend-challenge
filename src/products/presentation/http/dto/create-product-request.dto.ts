import { ApiProperty } from '@nestjs/swagger';
import { MAX_PRODUCT_PRICE_IN_CENTS } from '@/products/domain/constants/product-pricing.constants';

export class CreateProductRequestDto {
  @ApiProperty({
    example: 'Wireless Headphones',
    minLength: 1,
    maxLength: 120,
  })
  name: string;

  @ApiProperty({
    example: 'Wireless headphones with noise cancellation.',
    minLength: 1,
    maxLength: 500,
  })
  description: string;

  @ApiProperty({
    example: 59990,
    minimum: 1,
    maximum: MAX_PRODUCT_PRICE_IN_CENTS,
    description: 'Positive whole-number price in cents.',
  })
  priceInCents: number;
}
