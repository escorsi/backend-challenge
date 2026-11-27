import { UserRole } from '@/shared/domain/enums/user-role.enum';
import { type UsersWriter } from '@/users/application/ports/users-writer.port';
import type { CreateUserInput } from './create-user-input.interface';
import { type PasswordHasher } from '@/security/password-hasher.port';
import type { Clock } from '@/shared/application/ports/clock.port';
import type { IdGenerator } from '@/shared/application/ports/id-generator.port';
import {
  type ApplicationLogger,
  type ApplicationLoggerFactory,
} from '@/shared/application/ports/application-logger.port';

export class CreateUserService {
  private readonly logger: ApplicationLogger;

  constructor(
    private readonly usersWriter: UsersWriter,
    private readonly passwordHasher: PasswordHasher,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    loggerFactory: ApplicationLoggerFactory,
  ) {
    this.logger = loggerFactory.create(CreateUserService.name);
  }

  async execute(input: CreateUserInput) {
    const user = {
      id: this.idGenerator.generate(),
      name: input.name,
      email: input.email.trim().toLowerCase(),
      passwordHash: await this.passwordHasher.hash(input.password),
      role: UserRole.USER,
      createdAt: this.clock.now().toISOString(),
    };

    await this.usersWriter.create(user);

    this.logger.info('User registration processed');

    return {
      message: 'Registration request processed.',
    };
  }
}
