import { ApiProperty } from '@nestjs/swagger';

export class ApiErrorResponseDto {
  @ApiProperty({
    example: 400,
    description: 'HTTP status code',
  })
  statusCode: number;

  @ApiProperty({
    example: 'BAD_REQUEST',
    description: 'Application error code',
  })
  code: string;

  @ApiProperty({
    example: 'Request validation failed',
    description: 'Error message',
  })
  message: string;

  @ApiProperty({
    example: '2026-11-24T12:00:00.000Z',
    format: 'date-time',
    description: 'Error timestamp',
  })
  timestamp: string;

  @ApiProperty({
    example: '/v1/products?limit=200',
    description: 'Request path',
  })
  path: string;

  @ApiProperty({
    example: 'f4b8d92e-1c7a-4b6e-a123-123456789abc',
    description: 'Request correlation identifier',
  })
  requestId: string;
}
