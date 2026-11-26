import { ApiPropertyOptional } from '@nestjs/swagger';

export class ProductsQueryDto {
  @ApiPropertyOptional({
    description: 'Number of products per page (minimum: 1, maximum: 100)',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
    type: Number,
  })
  limit?: number;

  @ApiPropertyOptional({
    description: 'Opaque cursor returned by the previous page',
    example: 'eyJ2IjoxLCJzb3J0QnkiOi...',
  })
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Field used to sort products',
    enum: ['createdAt', 'name', 'price'],
    example: 'price',
    default: 'createdAt',
  })
  sortBy?: 'createdAt' | 'name' | 'price';

  @ApiPropertyOptional({
    description: 'Sorting direction',
    enum: ['asc', 'desc'],
    example: 'desc',
    default: 'desc',
  })
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({
    description: 'Search term (minimum: 1, maximum: 100 characters)',
    example: 'notebook',
    minLength: 1,
    maxLength: 100,
  })
  search?: string;
}
