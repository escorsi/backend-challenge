import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { validateEnv } from './config/env.validation';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { CommonModule } from './common/common.module';
import { ActuatorModule } from './actuator/actuator.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    RateLimitModule,
    CommonModule,
    ActuatorModule,
    AuthModule,
    ProductsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
