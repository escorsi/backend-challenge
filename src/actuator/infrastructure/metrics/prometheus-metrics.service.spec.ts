import { PrometheusMetricsService } from './prometheus-metrics.service';

describe('PrometheusMetricsService', () => {
  it('exposes default process metrics and the HTTP metric definitions', async () => {
    const service = new PrometheusMetricsService();

    expect(service.contentType).toContain('text/plain');
    const output = await service.getMetrics();
    expect(output).toContain('ton_backend_');
    expect(output).toContain('http_requests_total');
    expect(output).toContain('http_request_duration_seconds');
  });

  it('records request count and duration with bounded route labels', async () => {
    const service = new PrometheusMetricsService();

    service.recordHttpRequest(
      { method: 'GET', route: '/v1/products', status_code: '200' },
      0.125,
    );

    const output = await service.getMetrics();
    expect(output).toContain(
      'http_requests_total{method="GET",route="/v1/products",status_code="200"} 1',
    );
    expect(output).toContain(
      'http_request_duration_seconds_count{method="GET",route="/v1/products",status_code="200"} 1',
    );
    expect(output).toContain(
      'http_request_duration_seconds_sum{method="GET",route="/v1/products",status_code="200"} 0.125',
    );
  });
});
