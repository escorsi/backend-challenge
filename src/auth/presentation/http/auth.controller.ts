import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Throttle } from '@nestjs/throttler';

import { AuthService } from '../../application/login/auth.service';
import { loginSchema } from './schemas/login.schema';
import type { LoginDto } from './schemas/login.schema';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { LoginRequestDto } from './dto/login-request.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { ApiErrorResponses } from '../../../common/decorators/api-error-responses.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Authenticate User',
    description:
      'Authenticates a User and returns a JWT Access Token',
  })
  @ApiBody({ type: LoginRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
    type: LoginResponseDto,
  })
  @ApiErrorResponses(
    { status: HttpStatus.BAD_REQUEST, description: 'Invalid request body' },
    { status: HttpStatus.UNAUTHORIZED, description: 'Invalid credentials' },
    {
      status: HttpStatus.TOO_MANY_REQUESTS,
      description: 'Rate limit exceeded',
    },
    {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      description: 'Internal server error',
    },
  )
  login(
    @Body(new ZodValidationPipe(loginSchema))
    body: LoginDto,
  ) {
    return this.authService.login(body);
  }
}
