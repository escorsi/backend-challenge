import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';

import { AppModule } from './app.module';
import { createSwaggerConfig } from './config/swagger.config';

export async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.enableShutdownHooks();
  const configService = app.get(ConfigService);
  const helmetOptions =
    configService.get<string>('NODE_ENV') === 'production'
      ? {}
      : { strictTransportSecurity: false as const };
  const apiSecurityHeaders = helmet(helmetOptions);
  const swaggerSecurityHeaders = helmet({
    ...helmetOptions,
    contentSecurityPolicy: false,
  });

  app.use((request: Request, response: Response, next: NextFunction) => {
    const isSwaggerPath =
      request.path === '/api' || request.path.startsWith('/api/');
    const middleware = isSwaggerPath
      ? swaggerSecurityHeaders
      : apiSecurityHeaders;

    middleware(request, response, next);
  });

  const trustedProxyCidrs = configService
    .get<string>('TRUSTED_PROXY_CIDRS', '')
    .split(',')
    .map((cidr) => cidr.trim())
    .filter(Boolean);

  if (trustedProxyCidrs.length > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', trustedProxyCidrs);
  }

  app.setGlobalPrefix('v1');

  const document = SwaggerModule.createDocument(app, createSwaggerConfig());

  SwaggerModule.setup('api', app, document);

  await app.listen(configService.getOrThrow<number>('PORT'));
}

if (typeof require !== 'undefined' && require.main === module) {
  void bootstrap();
}
