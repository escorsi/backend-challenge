import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '@/shared/domain/enums/user-role.enum';

describe('RolesGuard', () => {
  const handler = vi.fn();
  const controller = vi.fn();

  const createContext = (user?: {
    id: string;
    email: string;
    role: UserRole;
  }) =>
    ({
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  it('allows routes without role metadata', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext())).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      handler,
      controller,
    ]);
  });

  it('rejects a protected route when the request has no user', () => {
    const guard = new RolesGuard({
      getAllAndOverride: vi.fn().mockReturnValue([UserRole.ADMIN]),
    } as unknown as Reflector);

    expect(() => guard.canActivate(createContext())).toThrow(
      ForbiddenException,
    );
  });

  it('allows routes when the role metadata is undefined', () => {
    const guard = new RolesGuard({
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    } as unknown as Reflector);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows an authenticated user with a required role', () => {
    const guard = new RolesGuard({
      getAllAndOverride: vi.fn().mockReturnValue([UserRole.ADMIN]),
    } as unknown as Reflector);

    expect(
      guard.canActivate(
        createContext({
          id: 'admin-1',
          email: 'admin@example.com',
          role: UserRole.ADMIN,
        }),
      ),
    ).toBe(true);
  });
});
