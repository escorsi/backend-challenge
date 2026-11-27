import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';

import {
  productsQuerySchema,
  type ProductsQueryDto,
} from './schemas/products-query.schema';

import { FindProductsService } from '../../application/use-cases/find-products/find-products.service';

import { ProductsResponseDto } from './dto/products-response.dto';
import { ApiErrorResponses } from '../../../common/decorators/api-error-responses.decorator';
import { ApiProductsQuery } from './decorators/api-products-query.decorator';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedUserThrottlerGuard } from '../../../common/rate-limit/authenticated-user-throttler.guard.js';

import { toProductResponse } from './mappers/product-response.mapper';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
@UseGuards(JwtAuthGuard, AuthenticatedUserThrottlerGuard)
export class ProductsController {
  constructor(
    private readonly findProductsService: FindProductsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List active products',
    description:
      'Returns active products with cursor-based pagination, sorting and search. ',
  })
  @Throttle({ authenticatedUser: { limit: 100, ttl: 60_000 } })
  @ApiProductsQuery()
  @ApiResponse({
    status: 200,
    description: 'Products retrieved successfully',
    type: ProductsResponseDto,
  })
  @ApiErrorResponses(
    {
      status: HttpStatus.BAD_REQUEST,
      description: 'Invalid query parameters or cursor',
    },
    {
      status: HttpStatus.UNAUTHORIZED,
      description: 'Missing or invalid access token',
    },
    {
      status: HttpStatus.TOO_MANY_REQUESTS,
      description: 'Rate limit exceeded',
    },
  )
  async findAll(
    @Query(new ZodValidationPipe(productsQuerySchema))
    query: ProductsQueryDto,
  ) {
    const { search, ...params } = query;
    const result = await this.findProductsService.execute({
      ...params,
      searchTerm: search,
    });

    return {
      items: result.items.map(toProductResponse),
      pagination: result.pagination,
    };
  }
}
