import { Module, type ExecutionContext } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { RedisModule, RedisToken } from '@nestjs-redis/client';
import {
  RedisThrottlerStorage,
  ThrottlerAlgorithm,
} from '@nestjs-redis/throttler-storage';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { ThrottlerGetTrackerFunction } from '@nestjs/throttler';

import { AuthenticatedUserThrottlerGuard } from './authenticated-user-throttler.guard';

interface RequestUser {
  user?: { id?: unknown };
}

const authenticatedUserTracker: ThrottlerGetTrackerFunction = (request) => {
  const user = (request as RequestUser).user;

  return typeof user?.id === 'string' && user.id.length > 0
    ? `user:${user.id}`
    : `ip:${String(request.ip ?? 'unknown')}`;
};

const skipAuthenticatedUserLimit = (context: ExecutionContext) => {
  const user = context.switchToHttp().getRequest<RequestUser>().user;

  return typeof user?.id !== 'string' || user.id.length === 0;
};

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [
        RedisModule.forRootAsync({
          isGlobal: true,
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            options: { url: configService.getOrThrow<string>('REDIS_URL') },
          }),
        }),
      ],
      inject: [RedisToken()],
      useFactory: (redis) => ({
        throttlers: [
          { name: 'default', ttl: 60_000, limit: 100 },
          {
            name: 'authenticatedUser',
            ttl: 60_000,
            limit: 100,
            skipIf: skipAuthenticatedUserLimit,
            getTracker: authenticatedUserTracker,
          },
        ],
        storage: new RedisThrottlerStorage(
          redis,
          ThrottlerAlgorithm.SlidingWindowCounter,
        ),
      }),
    }),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    ThrottlerGuard,
    AuthenticatedUserThrottlerGuard,
  ],
  exports: [ThrottlerModule, AuthenticatedUserThrottlerGuard],
})
export class RateLimitModule {}
