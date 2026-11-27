import { ApiProperty } from '@nestjs/swagger';
import { ProductStatus } from '../../../domain/enums/product-status.enum';

export class ProductResponseDto {
  @ApiProperty({
    example: '1',
    description: 'Unique product identifier',
  })
  id: string;

  @ApiProperty({
    example: 'Notebook',
    description: 'Product name',
  })
  name: string;

  @ApiProperty({
    example: 'Acer Nitro 5',
    description: 'Product description',
  })
  description: string;

  @ApiProperty({
    example: 450000,
    description: 'Product price in cents',
  })
  priceInCents: number;

  @ApiProperty({
    example: ProductStatus.ACTIVE,
    enum: ProductStatus,
    description: 'Product status',
  })
  status: ProductStatus;

  @ApiProperty({
    example: '2026-11-24T10:00:00.000Z',
    format: 'date-time',
    description: 'Product creation date',
  })
  createdAt: string;
}
