import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthUserReader } from '../ports/auth-user-reader.port';
import type { PasswordHasher } from '@/security/password-hasher.port';
import { AuthService } from './auth.service';
import type { AccessTokenIssuer } from '../ports/access-token-issuer.port';
import { InvalidCredentialsError } from '../errors/invalid-credentials.error';
import { UserRole } from '@/shared/domain/enums/user-role.enum';
import type {
  ApplicationLogger,
  ApplicationLoggerFactory,
} from '@/shared/application/ports/application-logger.port';

describe('AuthService', () => {
  let authService: AuthService;
  let usersRepository: AuthUserReader;
  let tokenIssuer: AccessTokenIssuer;
  let passwordHasher: PasswordHasher;
  let logger: ApplicationLogger;
  let loggerFactory: ApplicationLoggerFactory;

  const user = {
    id: 'user-123',
    email: 'admin@example.com',
    name: 'Admin',
    role: UserRole.ADMIN,
    passwordHash: 'hashed-password',
    createdAt: '2026-11-24T10:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    usersRepository = {
      findByEmail: vi.fn(),
    };

    tokenIssuer = {
      issue: vi.fn().mockResolvedValue({
        accessToken: 'mock-access-token',
        expiresIn: 900,
      }),
    };
    passwordHasher = {
      hash: vi.fn(),
      verify: vi.fn(),
    };
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    loggerFactory = { create: vi.fn().mockReturnValue(logger) };

    authService = new AuthService(
      usersRepository,
      tokenIssuer,
      passwordHasher,
      loggerFactory,
    );
  });

  describe('login', () => {
    it('should authenticate a user with valid credentials', async () => {
      vi.mocked(usersRepository.findByEmail).mockResolvedValue(user);

      vi.mocked(passwordHasher.verify).mockResolvedValue(true);

      const result = await authService.login({
        email: 'admin@example.com',
        password: 'correct-password',
      });

      expect(usersRepository.findByEmail).toHaveBeenCalledWith(
        'admin@example.com',
      );

      expect(passwordHasher.verify).toHaveBeenCalledWith(
        'correct-password',
        'hashed-password',
      );

      expect(tokenIssuer.issue).toHaveBeenCalledWith({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        tokenType: 'Bearer',
        expiresIn: 900,
      });
      expect(loggerFactory.create).toHaveBeenCalledWith('AuthService');
      expect(logger.info).toHaveBeenCalledWith('Authentication succeeded');
      expect(JSON.stringify(vi.mocked(logger.info).mock.calls)).not.toContain(
        'admin@example.com',
      );
    });

    it('should normalize the email before searching', async () => {
      vi.mocked(usersRepository.findByEmail).mockResolvedValue(user);

      vi.mocked(passwordHasher.verify).mockResolvedValue(true);

      await authService.login({
        email: '  ADMIN@EXAMPLE.COM  ',
        password: 'correct-password',
      });

      expect(usersRepository.findByEmail).toHaveBeenCalledWith(
        'admin@example.com',
      );
    });

    it('should return the expiration configured on the generated token', async () => {
      vi.mocked(usersRepository.findByEmail).mockResolvedValue(user);
      vi.mocked(passwordHasher.verify).mockResolvedValue(true);
      vi.mocked(tokenIssuer.issue).mockResolvedValue({
        accessToken: 'one-hour-token',
        expiresIn: 3600,
      });

      const result = await authService.login({
        email: 'admin@example.com',
        password: 'correct-password',
      });

      expect(result.expiresIn).toBe(3600);
    });

    it('should throw InvalidCredentialsError when user does not exist', async () => {
      vi.mocked(usersRepository.findByEmail).mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'unknown@example.com',
          password: 'any-password',
        }),
      ).rejects.toThrow(InvalidCredentialsError);

      expect(passwordHasher.verify).toHaveBeenCalledWith(
        'any-password',
        undefined,
      );
      expect(tokenIssuer.issue).not.toHaveBeenCalled();
    });

    it('should throw InvalidCredentialsError when password is incorrect', async () => {
      vi.mocked(usersRepository.findByEmail).mockResolvedValue(user);

      vi.mocked(passwordHasher.verify).mockResolvedValue(false);

      await expect(
        authService.login({
          email: 'admin@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(InvalidCredentialsError);

      expect(tokenIssuer.issue).not.toHaveBeenCalled();
    });

    it('should return the same error message for invalid credentials', async () => {
      vi.mocked(usersRepository.findByEmail).mockResolvedValue(null);

      let missingUserError: InvalidCredentialsError | undefined;

      try {
        await authService.login({
          email: 'unknown@example.com',
          password: 'any-password',
        });
      } catch (error: unknown) {
        if (error instanceof InvalidCredentialsError) {
          missingUserError = error;
        }
      }

      vi.mocked(usersRepository.findByEmail).mockResolvedValue(user);

      vi.mocked(passwordHasher.verify).mockResolvedValue(false);

      let invalidPasswordError: InvalidCredentialsError | undefined;

      try {
        await authService.login({
          email: 'admin@example.com',
          password: 'wrong-password',
        });
      } catch (error: unknown) {
        if (error instanceof InvalidCredentialsError) {
          invalidPasswordError = error;
        }
      }

      expect(missingUserError).toBeInstanceOf(InvalidCredentialsError);
      expect(invalidPasswordError).toBeInstanceOf(InvalidCredentialsError);

      expect(missingUserError?.message).toBe(invalidPasswordError?.message);

      expect(missingUserError?.message).toBe('Invalid credentials');
    });

    it('should not expose password information in the response', async () => {
      vi.mocked(usersRepository.findByEmail).mockResolvedValue(user);

      vi.mocked(passwordHasher.verify).mockResolvedValue(true);

      const result = await authService.login({
        email: 'admin@example.com',
        password: 'correct-password',
      });

      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('passwordHash');
    });
  });
});
