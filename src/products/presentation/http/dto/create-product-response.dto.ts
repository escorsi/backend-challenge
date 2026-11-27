import { ApiProperty } from '@nestjs/swagger';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';

export class CreateProductResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  id: string;

  @ApiProperty({ example: 'Wireless Headphones' })
  name: string;

  @ApiProperty({
    example: 'Wireless headphones with noise cancellation.',
  })
  description: string;

  @ApiProperty({ example: 59990 })
  priceInCents: number;

  @ApiProperty({
    example: ProductStatus.ACTIVE,
    enum: ProductStatus,
  })
  status: ProductStatus;

  @ApiProperty({
    example: '2026-11-25T15:00:00.000Z',
  })
  createdAt: string;
}
