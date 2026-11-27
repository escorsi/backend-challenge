import { Module } from '@nestjs/common';

import { DynamoDBModule } from '../database/dynamodb/dynamodb.module';
import { UsersRepository } from './infrastructure/dynamodb/users.repository';
import { USERS_WRITER } from './application/ports/users-writer.port';
import { UsersController } from './presentation/http/users.controller';
import { CreateUserService } from './application/use-cases/create-user/create-user.service';
import { SecurityModule } from '../security/security.module';
import { PASSWORD_HASHER } from '../security/password-hasher.port';
import type { UsersWriter } from './application/ports/users-writer.port';
import type { PasswordHasher } from '../security/password-hasher.port';
import { SystemModule } from '../shared/infrastructure/system/system.module';
import { CLOCK } from '../shared/application/ports/clock.port';
import { ID_GENERATOR } from '../shared/application/ports/id-generator.port';
import type { Clock } from '../shared/application/ports/clock.port';
import type { IdGenerator } from '../shared/application/ports/id-generator.port';
import { AUTH_USER_READER } from '../auth/application/ports/auth-user-reader.port';

@Module({
  imports: [DynamoDBModule, SecurityModule, SystemModule],
  controllers: [UsersController],
  providers: [
    UsersRepository,
    { provide: AUTH_USER_READER, useExisting: UsersRepository },
    { provide: USERS_WRITER, useExisting: UsersRepository },
    {
      provide: CreateUserService,
      inject: [USERS_WRITER, PASSWORD_HASHER, ID_GENERATOR, CLOCK],
      useFactory: (
        writer: UsersWriter,
        passwordHasher: PasswordHasher,
        idGenerator: IdGenerator,
        clock: Clock,
      ) => new CreateUserService(writer, passwordHasher, idGenerator, clock),
    },
  ],
  exports: [AUTH_USER_READER],
})
export class UsersModule {}
