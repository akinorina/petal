import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { buildOpenApiConfig } from './openapi.config';

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = SwaggerModule.createDocument(app, buildOpenApiConfig());
  const outPath = resolve(process.cwd(), 'openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2) + '\n', 'utf8');
  await app.close();
  console.log(`OpenAPI 仕様を出力しました: ${outPath}`);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
