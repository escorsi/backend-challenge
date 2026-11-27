import type { NextFunction, Request, Response } from 'express';

import type { RequestContext } from '@/shared/infrastructure/request-context/request-context.port';
import { RequestIdMiddleware } from './request-id.middleware';

describe('RequestIdMiddleware', () => {
  it('assigns a request ID and returns it in the response header', () => {
    const requestContext: RequestContext = {
      run: (_requestId, callback) => callback(),
      getRequestId: vi.fn(),
    };
    const run = vi.spyOn(requestContext, 'run');
    const middleware = new RequestIdMiddleware(requestContext);
    const request = {} as Request;
    const setHeader = vi.fn();
    const response = { setHeader } as unknown as Response;
    const next = vi.fn() as NextFunction;

    middleware.use(request, response, next);

    expect(request.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', request.requestId);
    expect(run).toHaveBeenCalledWith(request.requestId, expect.any(Function));
    expect(next).toHaveBeenCalledOnce();
  });
});
