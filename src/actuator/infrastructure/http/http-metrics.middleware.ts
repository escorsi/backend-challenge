import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { performance } from 'node:perf_hooks';

import { PrometheusMetricsService } from '../metrics/prometheus-metrics.service';

@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: PrometheusMetricsService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const startedAt = performance.now();

    response.once('finish', () => {
      const routePath = request.route?.path;
      const route = typeof routePath === 'string' ? routePath : 'unmatched';

      if (route.endsWith('/actuator/prometheus')) {
        return;
      }

      this.metrics.recordHttpRequest(
        {
          method: request.method,
          route,
          status_code: String(response.statusCode),
        },
        (performance.now() - startedAt) / 1000,
      );
    });

    next();
  }
}
