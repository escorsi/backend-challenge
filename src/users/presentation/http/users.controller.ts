import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { ApiErrorResponses } from '@/common/decorators/api-error-responses.decorator';
import { CreateUserService } from '@/users/application/use-cases/create-user/create-user.service';
import {
  createUserSchema,
  type CreateUserInput,
} from './schemas/create-user.schema';
import { CreateUserRequestDto } from './dto/create-user-request.dto';
import { CreateUserResponseDto } from './dto/create-user-response.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly createUserService: CreateUserService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User Registration' })
  @ApiBody({ type: CreateUserRequestDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Registration request processed',
    type: CreateUserResponseDto,
  })
  @ApiErrorResponses(
    { status: HttpStatus.BAD_REQUEST, description: 'Invalid user data' },
    {
      status: HttpStatus.TOO_MANY_REQUESTS,
      description: 'Rate limit exceeded',
    },
    {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      description: 'Internal server error',
    },
  )
  create(@Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput) {
    return this.createUserService.execute(body);
  }
}
