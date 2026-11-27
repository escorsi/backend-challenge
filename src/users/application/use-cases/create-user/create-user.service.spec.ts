import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateUserService } from './create-user.service';
import { UserRole } from '@/shared/domain/enums/user-role.enum';
import type { UsersWriter } from '@/users/application/ports/users-writer.port';
import type { PasswordHasher } from '@/security/password-hasher.port';
import type { Clock } from '@/shared/application/ports/clock.port';
import type { IdGenerator } from '@/shared/application/ports/id-generator.port';
import type {
  ApplicationLogger,
  ApplicationLoggerFactory,
} from '@/shared/application/ports/application-logger.port';

describe('CreateUserService', () => {
  let service: CreateUserService;
  let usersWriter: UsersWriter;
  let passwordHasher: PasswordHasher;
  let idGenerator: IdGenerator;
  let clock: Clock;
  let logger: ApplicationLogger;
  let loggerFactory: ApplicationLoggerFactory;

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
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    loggerFactory = { create: vi.fn().mockReturnValue(logger) };
    service = new CreateUserService(
      usersWriter,
      passwordHasher,
      idGenerator,
      clock,
      loggerFactory,
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
    expect(loggerFactory.create).toHaveBeenCalledWith('CreateUserService');
    expect(logger.info).toHaveBeenCalledWith('User registration processed');
    expect(JSON.stringify(vi.mocked(logger.info).mock.calls)).not.toContain(
      'new@example.com',
    );
    expect(JSON.stringify(vi.mocked(logger.info).mock.calls)).not.toContain(
      'hashed-password',
    );
  });
});
