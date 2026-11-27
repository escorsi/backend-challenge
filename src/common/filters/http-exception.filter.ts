import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { ApiErrorResponse } from '../interfaces/api-error-response.interface';
import { ApplicationErrorCode } from '@/shared/application/errors/application-error-code.enum';
import { ApplicationError } from '@/shared/application/errors/application.error';
import {
  type ApplicationLogger,
  type ApplicationLoggerFactory,
} from '@/shared/application/ports/application-logger.port';

const APPLICATION_ERROR_HTTP_STATUS: Record<ApplicationErrorCode, number> = {
  [ApplicationErrorCode.INVALID_CREDENTIALS]: HttpStatus.UNAUTHORIZED,
  [ApplicationErrorCode.INVALID_PRODUCT_CURSOR]: HttpStatus.BAD_REQUEST,
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger: ApplicationLogger;

  constructor(loggerFactory: ApplicationLoggerFactory) {
    this.logger = loggerFactory.create(HttpExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const applicationErrorStatus =
      exception instanceof ApplicationError
        ? APPLICATION_ERROR_HTTP_STATUS[exception.code]
        : undefined;

    const statusCode = isHttpException
      ? exception.getStatus()
      : (applicationErrorStatus ?? HttpStatus.INTERNAL_SERVER_ERROR);

    const message = this.getMessage(
      exception,
      isHttpException,
      applicationErrorStatus !== undefined,
    );
    const code = this.getErrorCode(statusCode);
    const requestId = request.requestId ?? 'unknown';

    const logMessage = `HTTP request failed (${statusCode} ${code})`;

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(logMessage);
    } else {
      this.logger.warn(logMessage);
    }

    const errorResponse: ApiErrorResponse = {
      statusCode,
      code,
      message,
      timestamp: new Date().toISOString(),
      path: request.path || request.url.split('?')[0] || '/',
      requestId,
    };

    response.status(statusCode).json(errorResponse);
  }

  private getMessage(
    exception: unknown,
    isHttpException: boolean,
    isMappedApplicationError: boolean,
  ): string {
    if (exception instanceof ApplicationError) {
      return isMappedApplicationError
        ? exception.message
        : 'Internal server error';
    }

    if (!isHttpException) {
      return 'Internal server error';
    }

    const response = (exception as HttpException).getResponse();

    if (typeof response === 'string') {
      return response;
    }

    if (
      typeof response === 'object' &&
      response !== null &&
      'message' in response
    ) {
      const message = response.message;

      if (Array.isArray(message)) {
        return 'Request validation failed';
      }

      if (typeof message === 'string') {
        return message;
      }
    }

    return 'Request failed';
  }

  private getErrorCode(statusCode: number): string {
    const errorCodes: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMIT_EXCEEDED',
    };

    return (
      errorCodes[statusCode] ??
      (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR
        ? 'INTERNAL_SERVER_ERROR'
        : 'HTTP_ERROR')
    );
  }
}
