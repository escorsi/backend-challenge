import { SafeConsoleLoggerAdapter } from './safe-console-logger.adapter';
import type { RequestContext } from '../request-context/request-context.port';
import { AsyncLocalRequestContextAdapter } from '../request-context/async-local-request-context.adapter';

describe('SafeConsoleLoggerAdapter', () => {
  let loggerFactory: SafeConsoleLoggerAdapter;
  let requestContext: RequestContext;
  let getRequestId = vi.fn<RequestContext['getRequestId']>();
  let stdoutWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getRequestId = vi.fn<RequestContext['getRequestId']>();
    requestContext = {
      run: (_requestId, callback) => callback(),
      getRequestId,
    };
    loggerFactory = new SafeConsoleLoggerAdapter(requestContext);
    stdoutWrite = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutWrite.mockRestore();
  });

  it('writes structured logs with the class context and descriptive message', () => {
    loggerFactory
      .create('ProductsService')
      .info('Product created successfully');

    const output = String(stdoutWrite.mock.calls[0][0]);
    const record = JSON.parse(output);

    expect(record).toEqual({
      timestamp: expect.any(String),
      level: 'info',
      context: 'ProductsService',
      message: 'Product created successfully',
    });
    expect(new Date(record.timestamp).toISOString()).toBe(record.timestamp);
  });

  it('adds the current request ID to every log in that async request flow', async () => {
    const asyncRequestContext = new AsyncLocalRequestContextAdapter();
    const requestLogger = new SafeConsoleLoggerAdapter(asyncRequestContext);
    const requestId = 'b3044cc9-0634-4fa7-8d3d-3db442ae55d6';

    await asyncRequestContext.run(requestId, async () => {
      await Promise.resolve();
      requestLogger.create('AuthService').info('Authentication succeeded');
    });

    const output = String(stdoutWrite.mock.calls[0][0]);
    expect(JSON.parse(output)).toMatchObject({
      context: 'AuthService',
      message: 'Authentication succeeded',
      requestId,
    });
  });

  it('redacts common sensitive values and removes log injection characters', () => {
    loggerFactory
      .create('AuthService\npassword=secret')
      .warn(
        'Login email=private@example.com password=secret token=private-token Bearer abc.def.ghi\nnext-line',
      );

    const output = String(stdoutWrite.mock.calls[0][0]);
    const record = JSON.parse(output);

    expect(record.context).toBe('AuthService_password_secret');
    expect(record.message).toBe(
      'Login email=[REDACTED_EMAIL] password=[REDACTED] token=[REDACTED] Bearer [REDACTED] next-line',
    );
    expect(output).not.toContain('private@example.com');
    expect(output).not.toContain('private-token');
    expect(output).not.toContain('abc.def.ghi');
    expect(output).not.toContain('\nnext-line');
  });

  it('omits request IDs that do not match the internal safe format', () => {
    getRequestId.mockReturnValue('request-id\npassword=secret');

    loggerFactory.create('AuthService').info('Authentication succeeded');

    const output = String(stdoutWrite.mock.calls[0][0]);
    expect(JSON.parse(output)).not.toHaveProperty('requestId');
    expect(output).not.toContain('secret');
  });

  it('does not let output failures interrupt application behavior', () => {
    stdoutWrite.mockImplementation(() => {
      throw new Error('stdout unavailable');
    });

    expect(() =>
      loggerFactory.create('ProductService').info('Product created'),
    ).not.toThrow();
  });
});
