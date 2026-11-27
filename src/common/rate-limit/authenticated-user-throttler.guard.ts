import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AuthenticatedUserThrottlerGuard extends ThrottlerGuard {
  override async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = this.throttlers.filter(
      ({ name }) => name === 'authenticatedUser',
    );
  }
}
