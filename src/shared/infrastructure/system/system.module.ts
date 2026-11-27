import { Injectable, Module } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { CLOCK, type Clock } from '@/shared/application/ports/clock.port';
import {
  ID_GENERATOR,
  type IdGenerator,
} from '@/shared/application/ports/id-generator.port';

@Injectable()
class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

@Injectable()
class UuidGenerator implements IdGenerator {
  generate(): string {
    return randomUUID();
  }
}

@Module({
  providers: [
    SystemClock,
    UuidGenerator,
    { provide: CLOCK, useExisting: SystemClock },
    { provide: ID_GENERATOR, useExisting: UuidGenerator },
  ],
  exports: [CLOCK, ID_GENERATOR],
})
export class SystemModule {}
