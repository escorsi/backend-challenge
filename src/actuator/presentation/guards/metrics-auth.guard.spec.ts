import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import { MetricsAuthGuard } from './metrics-auth.guard';

describe('MetricsAuthGuard', () => {
  const token = 'a-metrics-token-with-at-least-32-characters';

  const createContext = (authorization?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization } }),
      }),
    }) as unknown as ExecutionContext;

  it('allows a valid bearer token', () => {
    const guard = new MetricsAuthGuard({
      get: vi.fn().mockReturnValue(token),
    } as unknown as ConfigService);

    expect(guard.canActivate(createContext(`Bearer ${token}`))).toBe(true);
  });

  it.each([undefined, 'Bearer wrong-token', 'Basic credentials'])(
    'rejects missing or invalid credentials',
    (authorization) => {
      const guard = new MetricsAuthGuard({
        get: vi.fn().mockReturnValue(token),
      } as unknown as ConfigService);

      expect(() => guard.canActivate(createContext(authorization))).toThrow(
        UnauthorizedException,
      );
    },
  );

  it('denies access when no metrics token is configured', () => {
    const guard = new MetricsAuthGuard({
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as ConfigService);

    expect(() => guard.canActivate(createContext(`Bearer ${token}`))).toThrow(
      UnauthorizedException,
    );
  });
});
