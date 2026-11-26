import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type {
  AccessTokenIssuer,
  IssuedAccessToken,
} from '../../application/ports/access-token-issuer.port';
import type { JwtPayload } from '../../domain/jwt-payload.interface';

@Injectable()
export class JwtAccessTokenIssuerAdapter implements AccessTokenIssuer {
  constructor(private readonly jwtService: JwtService) {}

  async issue(payload: JwtPayload): Promise<IssuedAccessToken> {
    const accessToken = await this.jwtService.signAsync(payload);
    const tokenPayload = this.jwtService.decode(accessToken);

    if (
      !tokenPayload ||
      typeof tokenPayload !== 'object' ||
      typeof tokenPayload.iat !== 'number' ||
      typeof tokenPayload.exp !== 'number'
    ) {
      throw new Error('Generated access token is missing expiration claims');
    }

    return {
      accessToken,
      expiresIn: tokenPayload.exp - tokenPayload.iat,
    };
  }
}
