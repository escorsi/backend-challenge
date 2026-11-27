import { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';

import { UserRole } from '../../../shared/domain/enums/user-role.enum';
import { JwtAccessTokenIssuerAdapter } from './jwt-access-token-issuer.adapter';

describe('JwtAccessTokenIssuerAdapter', () => {
  const tokenPayload = {
    sub: 'user-1',
    email: 'user@example.com',
    role: UserRole.USER,
  };

  it('returns the signed token and its lifetime from its claims', async () => {
    const jwtService = {
      signAsync: vi.fn().mockResolvedValue('signed-token'),
      decode: vi.fn().mockReturnValue({ iat: 100, exp: 1000 }),
    } as unknown as JwtService;
    const issuer = new JwtAccessTokenIssuerAdapter(jwtService);

    await expect(issuer.issue(tokenPayload)).resolves.toEqual({
      accessToken: 'signed-token',
      expiresIn: 900,
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith(tokenPayload);
    expect(jwtService.decode).toHaveBeenCalledWith('signed-token');
  });

  it.each([
    ['a missing payload', null],
    ['a non-object payload', 'not-an-object'],
    ['a payload without an issued-at claim', { exp: 1000 }],
    ['a payload without an expiration claim', { iat: 100 }],
  ])('rejects %s', async (_description, decodedPayload) => {
    const jwtService = {
      signAsync: vi.fn().mockResolvedValue('signed-token'),
      decode: vi.fn().mockReturnValue(decodedPayload),
    } as unknown as JwtService;
    const issuer = new JwtAccessTokenIssuerAdapter(jwtService);

    await expect(issuer.issue(tokenPayload)).rejects.toThrow(
      'Generated access token is missing expiration claims',
    );
  });
});
