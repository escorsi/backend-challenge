import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { bootstrap } from './main';

const mocks = vi.hoisted(() => {
  const app = {
    enableShutdownHooks: vi.fn(),
    get: vi.fn(),
    use: vi.fn(),
    getHttpAdapter: vi.fn(),
    setGlobalPrefix: vi.fn(),
    listen: vi.fn().mockResolvedValue(undefined),
  };
  return {
    app,
    create: vi.fn(),
    helmet: vi.fn(() => vi.fn()),
    createDocument: vi.fn(() => ({ openapi: '3.1.0' })),
    setupSwagger: vi.fn(),
    builder: {
      setTitle: vi.fn().mockReturnThis(),
      setDescription: vi.fn().mockReturnThis(),
      setVersion: vi.fn().mockReturnThis(),
      addBearerAuth: vi.fn().mockReturnThis(),
      build: vi.fn(() => ({ title: 'Ton API' })),
    },
    proxy: vi.fn(),
  };
});

vi.mock('@nestjs/core', () => ({ NestFactory: { create: mocks.create } }));
vi.mock('@nestjs/swagger', () => ({
  DocumentBuilder: class DocumentBuilder {
    constructor() {
      return mocks.builder as never;
    }
  },
  SwaggerModule: {
    createDocument: mocks.createDocument,
    setup: mocks.setupSwagger,
  },
}));
vi.mock('helmet', () => ({ default: mocks.helmet }));
vi.mock('./app.module', () => ({ AppModule: class AppModule {} }));

describe('bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue(mocks.app);
    mocks.app.get.mockImplementation((token: unknown) => {
      if (token === ConfigService) {
        return {
          get: (key: string, fallback?: string) =>
            key === 'NODE_ENV' ? 'development' : fallback,
          getOrThrow: () => 3000,
        };
      }
      return {};
    });
    mocks.app.getHttpAdapter.mockReturnValue({
      getInstance: () => ({ set: mocks.proxy }),
    });
  });

  it('configures the application pipeline and listens on the configured port', async () => {
    await bootstrap();

    expect(NestFactory.create).toHaveBeenCalledWith(expect.any(Function), {
      bufferLogs: true,
    });
    expect(mocks.app.enableShutdownHooks).toHaveBeenCalledOnce();
    expect(helmet).toHaveBeenCalledTimes(2);
    expect(helmet).toHaveBeenNthCalledWith(1, {
      strictTransportSecurity: false,
    });
    expect(helmet).toHaveBeenNthCalledWith(2, {
      strictTransportSecurity: false,
      contentSecurityPolicy: false,
    });
    expect(mocks.app.setGlobalPrefix).toHaveBeenCalledWith('v1');
    expect(SwaggerModule.createDocument).toHaveBeenCalledWith(
      mocks.app,
      expect.objectContaining({ title: 'Ton API' }),
    );
    expect(SwaggerModule.setup).toHaveBeenCalledWith('api', mocks.app, {
      openapi: '3.1.0',
    });
    expect(mocks.app.listen).toHaveBeenCalledWith(3000);
    expect(mocks.proxy).not.toHaveBeenCalled();

    const securityMiddleware = mocks.app.use.mock.calls[0]?.[0] as Function;
    const response = {};
    const next = vi.fn();
    securityMiddleware({ path: '/api' }, response, next);
    securityMiddleware({ path: '/v1/products' }, response, next);
    expect(mocks.helmet).toHaveBeenCalledTimes(2);
  });

  it('enables HSTS in production and configures trusted proxy CIDRs', async () => {
    mocks.app.get.mockImplementation((token: unknown) => {
      if (token === ConfigService) {
        return {
          get: (key: string) =>
            key === 'NODE_ENV'
              ? 'production'
              : key === 'TRUSTED_PROXY_CIDRS'
                ? '10.0.0.0/8, 192.168.0.0/16'
                : undefined,
          getOrThrow: () => 4000,
        };
      }
      return {};
    });

    await bootstrap();

    expect(helmet).toHaveBeenNthCalledWith(1, {});
    expect(helmet).toHaveBeenNthCalledWith(2, {
      contentSecurityPolicy: false,
    });
    expect(mocks.proxy).toHaveBeenCalledWith('trust proxy', [
      '10.0.0.0/8',
      '192.168.0.0/16',
    ]);
    expect(mocks.app.listen).toHaveBeenCalledWith(4000);
  });
});
