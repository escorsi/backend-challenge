import type { JwtPayload } from '@/auth/domain/jwt-payload.interface';

export const ACCESS_TOKEN_ISSUER = Symbol('ACCESS_TOKEN_ISSUER');

export interface IssuedAccessToken {
  accessToken: string;
  expiresIn: number;
}

export interface AccessTokenIssuer {
  issue(payload: JwtPayload): Promise<IssuedAccessToken>;
}
