import 'dotenv/config';
import { DataSource } from 'typeorm';

const directUrl = process.env.DATABASE_URL_DIRECT;

export const AppDataSource = new DataSource(
  directUrl
    ? {
        type: 'postgres',
        url: directUrl,
        ssl: { rejectUnauthorized: false },
        entities: ['src/**/*.entity.ts'],
        migrations: ['database/migrations/*.ts'],
        synchronize: false,
      }
    : {
        type: 'postgres',
        host: process.env.DB_HOST ?? 'localhost',
        port: parseInt(process.env.DB_PORT ?? '5432', 10),
        username: process.env.DB_USERNAME ?? 'postgres',
        password: process.env.DB_PASSWORD ?? 'password',
        database: process.env.DB_DATABASE ?? 'petal',
        entities: ['src/**/*.entity.ts'],
        migrations: ['database/migrations/*.ts'],
        synchronize: false,
      },
);
