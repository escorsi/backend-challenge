import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from '@prometheus-io/client';

export interface HttpMetricLabels {
  method: string;
  route: string;
  status_code: string;
}

@Injectable()
export class PrometheusMetricsService {
  private readonly registry = new Registry();
  private readonly httpRequestsTotal: Counter<keyof HttpMetricLabels>;
  private readonly httpRequestDuration: Histogram<keyof HttpMetricLabels>;

  constructor() {
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'ton_backend_',
    });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of completed HTTP requests.',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of completed HTTP requests in seconds.',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });
  }

  get contentType(): string {
    return this.registry.contentType;
  }

  recordHttpRequest(labels: HttpMetricLabels, durationSeconds: number): void {
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, durationSeconds);
  }

  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
