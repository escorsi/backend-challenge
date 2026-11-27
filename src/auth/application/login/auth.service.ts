import { type PasswordHasher } from '@/security/password-hasher.port';
import type { LoginInput } from './login-input.interface';
import { InvalidCredentialsError } from '../errors/invalid-credentials.error';
import type { AccessTokenIssuer } from '../ports/access-token-issuer.port';
import type { AuthUserReader } from '../ports/auth-user-reader.port';
import {
  type ApplicationLogger,
  type ApplicationLoggerFactory,
} from '@/shared/application/ports/application-logger.port';

export class AuthService {
  private readonly logger: ApplicationLogger;

  constructor(
    private readonly usersReader: AuthUserReader,
    private readonly accessTokenIssuer: AccessTokenIssuer,
    private readonly passwordHasher: PasswordHasher,
    loggerFactory: ApplicationLoggerFactory,
  ) {
    this.logger = loggerFactory.create(AuthService.name);
  }

  async login({ email, password }: LoginInput) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.usersReader.findByEmail(normalizedEmail);

    const isPasswordValid = await this.passwordHasher.verify(
      password,
      user?.passwordHash,
    );

    if (!user || !isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    const issuedToken = await this.accessTokenIssuer.issue({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    this.logger.info('Authentication succeeded');

    return {
      accessToken: issuedToken.accessToken,
      tokenType: 'Bearer',
      expiresIn: issuedToken.expiresIn,
    };
  }
}
