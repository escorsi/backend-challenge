import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type {
  ThrottlerGetTrackerFunction,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';

import { AuthenticatedUserThrottlerGuard } from './authenticated-user-throttler.guard';

describe('AuthenticatedUserThrottlerGuard', () => {
  it('applies only the authenticated-user throttler after authentication', async () => {
    const getTracker: ThrottlerGetTrackerFunction = vi.fn((request) => {
      const user = request.user as { id: string };

      return `user:${user.id}`;
    });
    const options: ThrottlerModuleOptions = {
      throttlers: [
        { name: 'default', ttl: 60_000, limit: 100 },
        {
          name: 'authenticatedUser',
          ttl: 60_000,
          limit: 100,
          getTracker,
        },
      ],
    };
    const storage = {
      increment: vi.fn().mockResolvedValue({
        totalHits: 1,
        timeToExpire: 60_000,
        isBlocked: false,
        timeToBlockExpire: 0,
      }),
    };
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    };
    const guard = new AuthenticatedUserThrottlerGuard(
      options,
      storage as unknown as ThrottlerStorage,
      reflector as unknown as Reflector,
    );
    const request = { user: { id: 'user-123' } };
    const context = {
      getHandler: vi.fn(() => function findProducts() {}),
      getClass: vi.fn(() => class ProductsController {}),
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ setHeader: vi.fn() }),
      }),
    } as unknown as ExecutionContext;

    await guard.onModuleInit();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(storage.increment).toHaveBeenCalledOnce();
    expect(storage.increment).toHaveBeenCalledWith(
      expect.any(String),
      60_000,
      100,
      60_000,
      'authenticatedUser',
    );
    expect(getTracker).toHaveBeenCalledWith(request, context);
  });
});
