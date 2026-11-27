import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import {
  APPLICATION_LOGGER_FACTORY,
  type ApplicationLoggerFactory,
} from '../shared/application/ports/application-logger.port';
import { LoggingModule } from '../shared/infrastructure/logging/logging.module';
import { RequestIdMiddleware } from './middlewares/request-id.middleware';
import { HttpExceptionFilter } from './filters/http-exception.filter';

@Module({
  imports: [LoggingModule],
  providers: [
    {
      provide: APP_FILTER,
      inject: [APPLICATION_LOGGER_FACTORY],
      useFactory: (loggerFactory: ApplicationLoggerFactory) =>
        new HttpExceptionFilter(loggerFactory),
    },
  ],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
