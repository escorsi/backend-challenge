import { MODULE_METADATA } from '@nestjs/common/constants';
import { ActuatorModule } from './actuator.module';
import { HttpMetricsMiddleware } from './infrastructure/http/http-metrics.middleware';
import { MetricsAuthGuard } from './presentation/guards/metrics-auth.guard';
import { PrometheusMetricsService } from './infrastructure/metrics/prometheus-metrics.service';

describe('ActuatorModule', () => {
  it('registers its controller and metrics providers', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ActuatorModule),
    ).toEqual(expect.arrayContaining([expect.any(Function)]));
    expect(
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ActuatorModule),
    ).toEqual([
      MetricsAuthGuard,
      PrometheusMetricsService,
      HttpMetricsMiddleware,
    ]);
  });

  it('applies request metrics middleware to all routes', () => {
    const consumer = {
      apply: vi.fn().mockReturnThis(),
      forRoutes: vi.fn().mockReturnThis(),
    };

    new ActuatorModule().configure(consumer as never);

    expect(consumer.apply).toHaveBeenCalledWith(HttpMetricsMiddleware);
    expect(consumer.forRoutes).toHaveBeenCalledWith({
      path: '*path',
      method: expect.any(Number),
    });
  });
});
