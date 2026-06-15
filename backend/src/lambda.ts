import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import serverlessExpress from '@vendia/serverless-express';
import express from 'express';
import { Handler } from 'aws-lambda';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { AppModule } from './app.module';

let cachedHandler: Handler;

// AWS Secrets Manager（petal-backend-secrets-<stage>）から機密値を取得し
// process.env に注入する。SECRETS_MANAGER_SECRET_ID が未設定の環境（LOCAL）
// では何もしない。NestFactory.create より前に呼ぶことで、ConfigModule が
// シークレットを通常の環境変数として読めるようにする。
async function loadSecrets(): Promise<void> {
  const secretId = process.env.SECRETS_MANAGER_SECRET_ID;
  if (!secretId) return;

  const client = new SecretsManagerClient({});
  const res = await client.send(
    new GetSecretValueCommand({ SecretId: secretId }),
  );
  if (!res.SecretString) {
    throw new Error(`Secret ${secretId} has no SecretString`);
  }

  const secrets = JSON.parse(res.SecretString) as Record<string, string>;
  for (const [key, value] of Object.entries(secrets)) {
    // Secrets Manager を信頼できる出所として常に上書きする。
    process.env[key] = value;
  }
}

async function bootstrap(): Promise<Handler> {
  await loadSecrets();

  const expressApp = express();
  const nestApp = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
  );
  const corsOrigins = process.env.CORS_ORIGINS ?? '*';
  const origins =
    corsOrigins === '*'
      ? '*'
      : corsOrigins
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
  nestApp.enableCors({
    origin: origins,
    credentials: true,
  });
  await nestApp.init();
  return serverlessExpress({ app: expressApp });
}

export const handler: Handler = async (event, context, callback) => {
  if (!cachedHandler) {
    cachedHandler = await bootstrap();
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return cachedHandler(event, context, callback);
};
