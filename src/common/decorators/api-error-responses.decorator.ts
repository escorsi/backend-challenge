import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

import { ApiErrorResponseDto } from '../dto/api-error-response.dto';

export type ApiErrorStatus =
  | HttpStatus.BAD_REQUEST
  | HttpStatus.UNAUTHORIZED
  | HttpStatus.FORBIDDEN
  | HttpStatus.NOT_FOUND
  | HttpStatus.CONFLICT
  | HttpStatus.TOO_MANY_REQUESTS
  | HttpStatus.INTERNAL_SERVER_ERROR;

export interface ApiErrorResponseDescription {
  status: ApiErrorStatus;
  description: string;
}

const ERROR_CODE_BY_STATUS: Record<ApiErrorStatus, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMIT_EXCEEDED',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
};

export function ApiErrorResponses(...responses: ApiErrorResponseDescription[]) {
  return applyDecorators(
    ...responses.map(({ status, description }) => {
      const example: ApiErrorResponseDto = {
        statusCode: status,
        code: ERROR_CODE_BY_STATUS[status],
        message: description,
        timestamp: '2026-11-24T12:00:00.000Z',
        path: '/v1/resource',
        requestId: 'f4b8d92e-1c7a-4b6e-a123-123456789abc',
      };

      return ApiResponse({
        status,
        description,
        type: ApiErrorResponseDto,
        example,
      });
    }),
  );
}
