import { Module } from '@nestjs/common';

import { Argon2PasswordHasher } from './argon2-password-hasher.adapter';
import { PASSWORD_HASHER } from './password-hasher.port';

@Module({
  providers: [
    Argon2PasswordHasher,
    { provide: PASSWORD_HASHER, useExisting: Argon2PasswordHasher },
  ],
  exports: [PASSWORD_HASHER],
})
export class SecurityModule {}
