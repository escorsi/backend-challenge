import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

export async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.enableShutdownHooks();
  const configService = app.get(ConfigService);

  const trustedProxyCidrs = configService
    .get<string>('TRUSTED_PROXY_CIDRS', '')
    .split(',')
    .map((cidr) => cidr.trim())
    .filter(Boolean);

  if (trustedProxyCidrs.length > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', trustedProxyCidrs);
  }

  app.setGlobalPrefix('v1');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Stone Backend Challenge API')
    .setDescription('API for User Authentication and Product Listing.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('api', app, document);

  await app.listen(configService.getOrThrow<number>('PORT'));
}

if (typeof require !== 'undefined' && require.main === module) {
  void bootstrap();
}
