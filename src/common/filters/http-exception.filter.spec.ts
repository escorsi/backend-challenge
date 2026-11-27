import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

import { HttpExceptionFilter } from './http-exception.filter';
import { InvalidCredentialsError } from '../../auth/application/errors/invalid-credentials.error';
import { InvalidProductCursorError } from '../../products/application/errors/invalid-product-cursor.error';
import { ApplicationError } from '../../shared/application/errors/application.error';
import { ApplicationErrorCode } from '../../shared/application/errors/application-error-code.enum';
import type {
  ApplicationLogger,
  ApplicationLoggerFactory,
} from '../../shared/application/ports/application-logger.port';

class UnmappedApplicationError extends ApplicationError {
  constructor() {
    super('UNMAPPED' as ApplicationErrorCode, 'Sensitive internal detail');
  }
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let logger: ApplicationLogger;
  let loggerFactory: ApplicationLoggerFactory;

  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  let response: Response;
  let request: Request;

  beforeEach(() => {
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    loggerFactory = { create: vi.fn().mockReturnValue(logger) };
    filter = new HttpExceptionFilter(loggerFactory);

    jsonMock = vi.fn();

    response = {
      status: vi.fn().mockReturnThis(),
      json: jsonMock,
    } as unknown as Response;

    statusMock = vi.spyOn(response, 'status');

    request = {
      method: 'GET',
      url: '/v1/products',
      route: { path: '/v1/products' },
      requestId: 'test-request-id',
    } as Request;
  });

  const createArgumentsHost = (): ArgumentsHost =>
    ({
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    }) as ArgumentsHost;

  it('should handle an HttpException', () => {
    const exception = new HttpException(
      'Invalid credentials',
      HttpStatus.UNAUTHORIZED,
    );

    filter.catch(exception, createArgumentsHost());

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
        path: '/v1/products',
        requestId: 'test-request-id',
      }),
    );
  });

  it('should handle validation errors', () => {
    const exception = new HttpException(
      {
        statusCode: 400,
        message: ['email must be valid', 'password is required'],
        error: 'Bad Request',
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, createArgumentsHost());

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: 'Request validation failed',
        requestId: 'test-request-id',
      }),
    );
  });

  it('should handle unexpected errors without exposing internal details', () => {
    const exception = new Error(
      'Database connection failed: sensitive information',
    );

    filter.catch(exception, createArgumentsHost());

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        requestId: 'test-request-id',
      }),
    );

    expect(jsonMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        message: exception.message,
      }),
    );
  });

  it('should omit exception details and query parameters from error logs', () => {
    request.url = '/v1/users?token=query-secret';
    request.route = { path: '/v1/users' } as Request['route'];
    filter.catch(
      new Error('Database password=exception-secret'),
      createArgumentsHost(),
    );

    expect(loggerFactory.create).toHaveBeenCalledWith('HttpExceptionFilter');
    expect(logger.error).toHaveBeenCalledWith(
      'HTTP request failed (500 INTERNAL_SERVER_ERROR)',
    );
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(
      'query-secret',
    );
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(
      'exception-secret',
    );
  });

  it('should include timestamp, request path and request ID', () => {
    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

    filter.catch(exception, createArgumentsHost());

    const payload = jsonMock.mock.calls[0][0];

    expect(payload.timestamp).toBeDefined();
    expect(new Date(payload.timestamp).toISOString()).toBe(payload.timestamp);
    expect(payload.path).toBe('/v1/products');
    expect(payload.requestId).toBe('test-request-id');
  });

  it('should return unknown when request ID is unavailable', () => {
    request.requestId = undefined;

    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

    filter.catch(exception, createArgumentsHost());

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'unknown',
      }),
    );
  });

  it('should map rate limit errors correctly', () => {
    const exception = new HttpException(
      'Too Many Requests',
      HttpStatus.TOO_MANY_REQUESTS,
    );

    filter.catch(exception, createArgumentsHost());

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        requestId: 'test-request-id',
      }),
    );
  });

  it('should use safe fallbacks for unmapped HTTP errors', () => {
    request.route = undefined as Request['route'];
    const exception = new HttpException(
      { error: 'Unprocessable Entity' },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );

    filter.catch(exception, createArgumentsHost());

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        code: 'HTTP_ERROR',
        message: 'Request failed',
      }),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'HTTP request failed (422 HTTP_ERROR)',
    );
  });

  it('should hide details for application errors without an HTTP mapping', () => {
    filter.catch(new UnmappedApplicationError(), createArgumentsHost());

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      }),
    );
  });

  it.each([
    [new InvalidCredentialsError(), 401, 'UNAUTHORIZED', 'Invalid credentials'],
    [
      new InvalidProductCursorError(
        'Cursor does not match the current query parameters',
      ),
      400,
      'BAD_REQUEST',
      'Cursor does not match the current query parameters',
    ],
  ])(
    'maps application error %s to its HTTP response',
    (exception, statusCode, code, message) => {
      filter.catch(exception, createArgumentsHost());

      expect(statusMock).toHaveBeenCalledWith(statusCode);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode, code, message }),
      );
    },
  );
});
