import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';

import { PrometheusMetricsService } from '../../infrastructure/metrics/prometheus-metrics.service';
import { MetricsAuthGuard } from '../guards/metrics-auth.guard';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Health Check')
@Controller('actuator')
export class ActuatorController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly metricsService: PrometheusMetricsService,
  ) {}

  @Get('health')
  @HealthCheck()
  @SkipThrottle()
  liveness() {
    return this.healthCheckService.check([]);
  }

  @Get('prometheus')
  @UseGuards(MetricsAuthGuard)
  async prometheus(@Res() response: Response): Promise<void> {
    response.setHeader('Content-Type', this.metricsService.contentType);
    response.send(await this.metricsService.getMetrics());
  }
}
