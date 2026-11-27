export const REQUEST_CONTEXT = Symbol('REQUEST_CONTEXT');

export interface RequestContext {
  run<T>(requestId: string, callback: () => T): T;
  getRequestId(): string | undefined;
}
