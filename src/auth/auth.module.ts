import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { SignOptions } from 'jsonwebtoken';

import { AuthController } from './presentation/http/auth.controller';
import { AuthService } from './application/login/auth.service';
import { JwtStrategy } from './infrastructure/jwt/jwt.strategy';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard';
import { SecurityModule } from '../security/security.module';
import { PASSWORD_HASHER } from '../security/password-hasher.port';
import { ACCESS_TOKEN_ISSUER } from './application/ports/access-token-issuer.port';
import { JwtAccessTokenIssuerAdapter } from './infrastructure/jwt/jwt-access-token-issuer.adapter';
import type { PasswordHasher } from '../security/password-hasher.port';
import type { AccessTokenIssuer } from './application/ports/access-token-issuer.port';
import type { AuthUserReader } from './application/ports/auth-user-reader.port';

@Module({
  imports: [
    PassportModule,
    SecurityModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          algorithm: 'HS256',
          expiresIn:
            configService.getOrThrow<SignOptions['expiresIn']>(
              'JWT_EXPIRES_IN',
            ),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    JwtAccessTokenIssuerAdapter,
    {
      provide: ACCESS_TOKEN_ISSUER,
      useExisting: JwtAccessTokenIssuerAdapter,
    },
    {
      provide: AuthService,
      inject: [ACCESS_TOKEN_ISSUER, PASSWORD_HASHER],
      useFactory: (
        usersReader: AuthUserReader,
        tokenIssuer: AccessTokenIssuer,
        passwordHasher: PasswordHasher,
      ) => new AuthService(usersReader, tokenIssuer, passwordHasher),
    },
    JwtStrategy,
    JwtAuthGuard,
  ],
  exports: [AuthService, JwtAuthGuard, PassportModule],
})
export class AuthModule {}
