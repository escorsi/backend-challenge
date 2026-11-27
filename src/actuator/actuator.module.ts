import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { DynamoDBModule } from '../database/dynamodb/dynamodb.module';
import { RateLimitModule } from '../common/rate-limit/rate-limit.module';

import { ActuatorController } from './presentation/http/actuator.controller';
import { MetricsAuthGuard } from './presentation/guards/metrics-auth.guard';
import { HttpMetricsMiddleware } from './infrastructure/http/http-metrics.middleware';
import { PrometheusMetricsService } from './infrastructure/metrics/prometheus-metrics.service';

@Module({
  imports: [
    TerminusModule.forRoot({ gracefulShutdownTimeoutMs: 1_000 }),
    DynamoDBModule,
    RateLimitModule,
  ],
  controllers: [ActuatorController],
  providers: [
    MetricsAuthGuard,
    PrometheusMetricsService,
    HttpMetricsMiddleware,
  ],
})
export class ActuatorModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(HttpMetricsMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
