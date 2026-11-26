import { type PasswordHasher } from '../../../security/password-hasher.port';
import type { LoginInput } from './login-input.interface';
import { InvalidCredentialsError } from '../errors/invalid-credentials.error';
import type { AccessTokenIssuer } from '../ports/access-token-issuer.port';
import type { AuthUserReader } from '../ports/auth-user-reader.port';

export class AuthService {
  constructor(
    private readonly usersReader: AuthUserReader,
    private readonly accessTokenIssuer: AccessTokenIssuer,
    private readonly passwordHasher: PasswordHasher,
  ) {}

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

    return {
      accessToken: issuedToken.accessToken,
      tokenType: 'Bearer',
      expiresIn: issuedToken.expiresIn,
    };
  }
}
