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

import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '@/auth/presentation/guards/jwt-auth.guard';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import {
  productsQuerySchema,
  type ProductsQueryDto,
} from './schemas/products-query.schema';

import { FindProductsService } from '@/products/application/use-cases/find-products/find-products.service';
import { CreateProductService } from '@/products/application/use-cases/create-product/create-product.service';

import { ProductsResponseDto } from './dto/products-response.dto';
import { ApiErrorResponses } from '@/common/decorators/api-error-responses.decorator';
import { ApiProductsQuery } from './decorators/api-products-query.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/shared/domain/enums/user-role.enum';

import {
  createProductSchema,
  type CreateProductDto,
} from './schemas/create-product.schema';
import { CreateProductResponseDto } from './dto/create-product-response.dto';
import { CreateProductRequestDto } from './dto/create-product-request.dto';
import { AuthenticatedUserThrottlerGuard } from '@/common/rate-limit/authenticated-user-throttler.guard';

import { toProductResponse } from './mappers/product-response.mapper';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
@UseGuards(JwtAuthGuard, AuthenticatedUserThrottlerGuard)
export class ProductsController {
  constructor(
    private readonly findProductsService: FindProductsService,
    private readonly createProductService: CreateProductService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List active products',
    description:
      'Returns active products with cursor-based pagination, sorting and search.',
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
    {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      description: 'Internal server error',
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

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Throttle({ authenticatedUser: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Create a product',
    description:
      'Creates an active product. Only administrators can perform this operation.',
  })
  @ApiBody({ type: CreateProductRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Product created successfully',
    type: CreateProductResponseDto,
  })
  @ApiErrorResponses(
    { status: HttpStatus.BAD_REQUEST, description: 'Invalid product data' },
    {
      status: HttpStatus.UNAUTHORIZED,
      description: 'Missing or invalid access token',
    },
    { status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' },
    {
      status: HttpStatus.TOO_MANY_REQUESTS,
      description: 'Rate limit exceeded',
    },
    {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      description: 'Internal server error',
    },
  )
  async create(
    @Body(new ZodValidationPipe(createProductSchema))
    body: CreateProductDto,
  ) {
    return toProductResponse(await this.createProductService.execute(body));
  }
}
