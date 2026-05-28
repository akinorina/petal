import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import serverlessExpress from '@vendia/serverless-express';
import express from 'express';
import { Handler } from 'aws-lambda';
import { AppModule } from './app.module';

let cachedHandler: Handler;

async function bootstrap(): Promise<Handler> {
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
