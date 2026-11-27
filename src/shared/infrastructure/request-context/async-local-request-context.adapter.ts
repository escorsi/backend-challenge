import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

import type { RequestContext } from './request-context.port';

interface RequestContextStore {
  requestId: string;
}

@Injectable()
export class AsyncLocalRequestContextAdapter implements RequestContext {
  private readonly storage = new AsyncLocalStorage<RequestContextStore>();

  run<T>(requestId: string, callback: () => T): T {
    return this.storage.run({ requestId }, callback);
  }

  getRequestId(): string | undefined {
    return this.storage.getStore()?.requestId;
  }
}
