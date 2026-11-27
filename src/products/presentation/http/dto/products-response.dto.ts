import { ApiProperty } from '@nestjs/swagger';
import { ProductStatus } from '../../../domain/enums/product-status.enum';

import { ProductResponseDto } from './product-response.dto';

export class ProductsPaginationDto {
  @ApiProperty({
    example: 1,
    description: 'Number of products returned in this page.',
  })
  pageSize: number;

  @ApiProperty({
    type: String,
    example: 'eyJ2IjoxLCJzb3J0QnkiOi...',
    nullable: true,
    description:
      'Cursor to retrieve the next page. Null when there are no more results.',
  })
  nextCursor: string | null;

  @ApiProperty({
    example: true,
    description: 'Indicates whether another page is available',
  })
  hasNextPage: boolean;
}

export class ProductsResponseDto {
  @ApiProperty({
    type: [ProductResponseDto],
    example: [
      {
        id: 'product-123',
        name: 'Notebook',
        description: 'Acer Nitro 5',
        priceInCents: 450000,
        status: ProductStatus.ACTIVE,
        createdAt: '2026-11-24T10:00:00.000Z',
      },
    ],
  })
  items: ProductResponseDto[];

  @ApiProperty({
    type: ProductsPaginationDto,
    example: {
      pageSize: 1,
      nextCursor: 'eyJ2IjoxLCJzb3J0QnkiOi...',
      hasNextPage: true,
    },
  })
  pagination: ProductsPaginationDto;
}
