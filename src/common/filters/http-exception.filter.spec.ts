import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { HttpExceptionFilter } from './http-exception.filter';
import { InvalidCredentialsError } from '../../auth/application/errors/invalid-credentials.error';
import { InvalidProductCursorError } from '../../products/application/errors/invalid-product-cursor.error';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  let response: Response;
  let request: Request;

  beforeEach(() => {
    filter = new HttpExceptionFilter();

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
    const loggerSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    filter.catch(
      new Error('Database password=exception-secret'),
      createArgumentsHost(),
    );

    expect(loggerSpy).toHaveBeenCalledWith(
      'HTTP 500 GET /v1/users INTERNAL_SERVER_ERROR requestId=test-request-id',
    );
    expect(JSON.stringify(loggerSpy.mock.calls)).not.toContain('query-secret');
    expect(JSON.stringify(loggerSpy.mock.calls)).not.toContain(
      'exception-secret',
    );
    loggerSpy.mockRestore();
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
