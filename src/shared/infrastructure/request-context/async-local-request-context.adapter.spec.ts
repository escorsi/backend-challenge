import { AsyncLocalRequestContextAdapter } from './async-local-request-context.adapter';

describe('AsyncLocalRequestContextAdapter', () => {
  it('keeps the request ID available across asynchronous work in one flow', async () => {
    const context = new AsyncLocalRequestContextAdapter();
    const runFlow = (requestId: string, delay: number) =>
      context.run(requestId, async () => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return context.getRequestId();
      });

    await expect(
      Promise.all([runFlow('request-a', 5), runFlow('request-b', 1)]),
    ).resolves.toEqual(['request-a', 'request-b']);
    expect(context.getRequestId()).toBeUndefined();
  });
});
