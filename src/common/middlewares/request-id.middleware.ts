import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

import {
  REQUEST_CONTEXT,
  type RequestContext,
} from '@/shared/infrastructure/request-context/request-context.port';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  constructor(
    @Inject(REQUEST_CONTEXT)
    private readonly requestContext: RequestContext,
  ) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const requestId = randomUUID();
    request.requestId = requestId;

    response.setHeader('X-Request-Id', requestId);
    this.requestContext.run(requestId, () => next());
  }
}
