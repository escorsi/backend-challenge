import { createHash, timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class MetricsAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expectedToken = this.configService.get<string>(
      'METRICS_BEARER_TOKEN',
    );
    const authorization = context.switchToHttp().getRequest<Request>()
      .headers.authorization;
    const suppliedToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (
      !expectedToken ||
      !suppliedToken ||
      !this.tokensMatch(suppliedToken, expectedToken)
    ) {
      throw new UnauthorizedException();
    }

    return true;
  }

  private tokensMatch(suppliedToken: string, expectedToken: string): boolean {
    const suppliedDigest = createHash('sha256').update(suppliedToken).digest();
    const expectedDigest = createHash('sha256').update(expectedToken).digest();

    return timingSafeEqual(suppliedDigest, expectedDigest);
  }
}
