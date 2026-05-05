import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

// .env fayldan o'qish uchun
dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'education_crm',
  synchronize: false, // Migratsiyalar paytida har doim false bo'lishi kerak
  logging: false,
  entities: [
    join(__dirname, '/**/*.entity{.ts,.js}'),
    join(__dirname, '/entities/*{.ts,.js}'),
  ],
  migrations: [join(__dirname, '/migrations/*{.ts,.js}')],
  subscribers: [],
});
