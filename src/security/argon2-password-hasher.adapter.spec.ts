import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as argon2 from 'argon2';

import { Argon2PasswordHasher } from './argon2-password-hasher.adapter';

vi.mock('argon2', () => ({
  argon2id: 2,
  hash: vi.fn(),
  verify: vi.fn(),
}));

describe('Argon2PasswordHasher', () => {
  let hasher: Argon2PasswordHasher;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(argon2.hash).mockResolvedValue('dummy-hash');
    vi.mocked(argon2.verify).mockResolvedValue(true);
    hasher = new Argon2PasswordHasher();
  });

  it('hashes passwords with Argon2id', async () => {
    vi.mocked(argon2.hash).mockResolvedValueOnce('password-hash');

    await expect(hasher.hash('secret')).resolves.toBe('password-hash');
    expect(argon2.hash).toHaveBeenCalledWith('secret', {
      type: argon2.argon2id,
    });
  });

  it('uses a dummy hash when verifying credentials for a missing user', async () => {
    await expect(hasher.verify('candidate-password')).resolves.toBe(true);
    expect(argon2.verify).toHaveBeenCalledWith(
      'dummy-hash',
      'candidate-password',
    );
  });
});
