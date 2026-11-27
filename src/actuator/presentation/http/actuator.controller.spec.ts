import type { Response } from 'express';
import { ActuatorController } from './actuator.controller';
import type { PrometheusMetricsService } from '@/actuator/infrastructure/metrics/prometheus-metrics.service';

describe('ActuatorController', () => {
  it('delegates health checks to Terminus', async () => {
    const healthCheckService = {
      check: vi.fn().mockResolvedValue({ status: 'ok' }),
    };
    const controller = new ActuatorController(
      healthCheckService as never,
      {} as PrometheusMetricsService,
    );

    await expect(controller.liveness()).resolves.toEqual({ status: 'ok' });
    expect(healthCheckService.check).toHaveBeenCalledWith([]);
  });

  it('sets the Prometheus content type and returns the metrics payload', async () => {
    const metricsService = {
      contentType: 'text/plain; version=0.0.4',
      getMetrics: vi.fn().mockResolvedValue('http_requests_total 1'),
    } as unknown as PrometheusMetricsService;
    const response = {
      setHeader: vi.fn(),
      send: vi.fn(),
    } as unknown as Response;
    const controller = new ActuatorController({} as never, metricsService);

    await controller.prometheus(response);

    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/plain; version=0.0.4',
    );
    expect(response.send).toHaveBeenCalledWith('http_requests_total 1');
  });
});
