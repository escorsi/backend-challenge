import { Module } from '@nestjs/common';

import { APPLICATION_LOGGER_FACTORY } from '../../application/ports/application-logger.port';
import { AsyncLocalRequestContextAdapter } from '../request-context/async-local-request-context.adapter';
import { REQUEST_CONTEXT } from '../request-context/request-context.port';
import { SafeConsoleLoggerAdapter } from './safe-console-logger.adapter';

@Module({
  providers: [
    AsyncLocalRequestContextAdapter,
    {
      provide: REQUEST_CONTEXT,
      useExisting: AsyncLocalRequestContextAdapter,
    },
    SafeConsoleLoggerAdapter,
    {
      provide: APPLICATION_LOGGER_FACTORY,
      useExisting: SafeConsoleLoggerAdapter,
    },
  ],
  exports: [APPLICATION_LOGGER_FACTORY, REQUEST_CONTEXT],
})
export class LoggingModule {}
