import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateUserService } from './create-user.service';
import { UserRole } from '../../../../shared/domain/enums/user-role.enum';
import type { UsersWriter } from '../../ports/users-writer.port';
import type { PasswordHasher } from '../../../../security/password-hasher.port';
import type { Clock } from '../../../../shared/application/ports/clock.port';
import type { IdGenerator } from '../../../../shared/application/ports/id-generator.port';

describe('CreateUserService', () => {
  let service: CreateUserService;
  let usersWriter: UsersWriter;
  let passwordHasher: PasswordHasher;
  let idGenerator: IdGenerator;
  let clock: Clock;

  beforeEach(() => {
    vi.clearAllMocks();
    usersWriter = { create: vi.fn() };
    passwordHasher = {
      hash: vi.fn().mockResolvedValue('hashed-password'),
      verify: vi.fn(),
    };
    idGenerator = { generate: vi.fn().mockReturnValue('user-id') };
    clock = {
      now: vi.fn().mockReturnValue(new Date('2026-11-26T12:00:00.000Z')),
    };
    service = new CreateUserService(
      usersWriter,
      passwordHasher,
      idGenerator,
      clock,
    );
  });

  it('stores a regular user and returns a generic registration response', async () => {
    vi.mocked(usersWriter.create).mockResolvedValue(undefined);

    const result = await service.execute({
      name: 'New User',
      email: 'new@example.com',
      password: 'secure-password',
    });

    expect(usersWriter.create).toHaveBeenCalledWith({
      id: 'user-id',
      name: 'New User',
      email: 'new@example.com',
      passwordHash: 'hashed-password',
      role: UserRole.USER,
      createdAt: '2026-11-26T12:00:00.000Z',
    });
    expect(result).toEqual({ message: 'Registration request processed.' });
    expect(result).not.toHaveProperty('passwordHash');
  });

});
