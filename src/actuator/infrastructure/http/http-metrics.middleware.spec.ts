import { EventEmitter } from 'node:events';
import type { NextFunction, Request, Response } from 'express';
import { HttpMetricsMiddleware } from './http-metrics.middleware';
import type { PrometheusMetricsService } from '../metrics/prometheus-metrics.service';

describe('HttpMetricsMiddleware', () => {
  afterEach(() => vi.restoreAllMocks());

  it('records completed requests using the route template and elapsed seconds', () => {
    const metrics = {
      recordHttpRequest: vi.fn(),
    } as unknown as PrometheusMetricsService;
    const middleware = new HttpMetricsMiddleware(metrics);
    const response = new EventEmitter() as Response;
    Object.assign(response, { statusCode: 201 });
    const request = {
      method: 'POST',
      route: { path: '/v1/products/:id' },
    } as unknown as Request;
    const next = vi.fn() as NextFunction;
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(350);

    middleware.use(request, response, next);
    expect(next).toHaveBeenCalledOnce();

    response.emit('finish');

    expect(metrics.recordHttpRequest).toHaveBeenCalledWith(
      { method: 'POST', route: '/v1/products/:id', status_code: '201' },
      0.25,
    );
  });

  it('uses a bounded fallback route and skips the Prometheus scrape itself', () => {
    const metrics = {
      recordHttpRequest: vi.fn(),
    } as unknown as PrometheusMetricsService;
    const middleware = new HttpMetricsMiddleware(metrics);
    const response = new EventEmitter() as Response;
    Object.assign(response, { statusCode: 404 });
    const next = vi.fn() as NextFunction;

    middleware.use({ method: 'GET' } as Request, response, next);
    response.emit('finish');
    expect(metrics.recordHttpRequest).toHaveBeenCalledWith(
      { method: 'GET', route: 'unmatched', status_code: '404' },
      expect.any(Number),
    );

    middleware.use(
      { method: 'GET', route: { path: '/v1/actuator/prometheus' } } as Request,
      response,
      next,
    );
    response.emit('finish');
    expect(metrics.recordHttpRequest).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledTimes(2);
  });
});
