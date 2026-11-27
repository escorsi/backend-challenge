import { MODULE_METADATA } from '@nestjs/common/constants';
import { AppModule } from './app.module';
import { ActuatorModule } from './actuator/actuator.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';

describe('AppModule', () => {
  it('registers global configuration, logging, persistence, and feature modules', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      AppModule,
    ) as unknown[];
    const importedClasses = imports.filter(
      (entry): entry is Function => typeof entry === 'function',
    );

    expect(importedClasses).toEqual(
      expect.arrayContaining([
        AuthModule,
        ProductsModule,
        RateLimitModule,
        ActuatorModule,
      ]),
    );
    expect(imports.some((entry) => typeof entry === 'object')).toBe(true);
  });
});
