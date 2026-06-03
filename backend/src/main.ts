import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { buildOpenApiConfig } from './openapi.config';
import * as fs from 'node:fs';

async function bootstrap() {
  const httpsOptions =
    process.env.HTTPS === 'true'
      ? {
          key: fs.readFileSync('../certs/localhost+2-key.pem'),
          cert: fs.readFileSync('../certs/localhost+2.pem'),
        }
      : undefined;

  const app = await NestFactory.create(AppModule, { httpsOptions });
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3001')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    credentials: true,
  });

  const document = SwaggerModule.createDocument(app, buildOpenApiConfig());
  SwaggerModule.setup('api-docs', app, document, {
    jsonDocumentUrl: 'api-docs-json',
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
