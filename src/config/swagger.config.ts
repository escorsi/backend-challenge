import { DocumentBuilder } from '@nestjs/swagger';

export function createSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('Ton API')
    .setDescription('REST API for user authentication and product listing.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        description: 'Metrics token configured in METRICS_BEARER_TOKEN.',
      },
      'metricsBearer',
    )
    .build();
}
