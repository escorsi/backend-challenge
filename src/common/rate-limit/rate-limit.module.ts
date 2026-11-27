import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { RedisModule, RedisToken } from '@nestjs-redis/client';
import {
  RedisThrottlerStorage,
  ThrottlerAlgorithm,
} from '@nestjs-redis/throttler-storage';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuthenticatedUserThrottlerGuard } from './authenticated-user-throttler.guard';

@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [
        RedisModule.forRootAsync({
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
            skipIf: (context) => !context.switchToHttp().getRequest().user?.id,
            getTracker: (request) => `user:${request.user.id}`,
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
  exports: [ThrottlerModule, ThrottlerGuard, AuthenticatedUserThrottlerGuard],
})
export class RateLimitModule {}
