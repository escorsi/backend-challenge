import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';

import type { PasswordHasher } from './password-hasher.port';

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  private readonly dummyPasswordHash: Promise<string>;

  constructor() {
    this.dummyPasswordHash = this.hash(randomUUID());
  }

  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verify(password: string, passwordHash?: string): Promise<boolean> {
    const hash = passwordHash ?? (await this.dummyPasswordHash);

    return argon2.verify(hash, password);
  }
}
