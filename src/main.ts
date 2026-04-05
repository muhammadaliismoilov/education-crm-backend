import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as fs from 'fs';
import * as express from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Kerakli papkalarni avtomatik yaratish
  const requiredDirs = ['uploads/students'];
  requiredDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.log(`Papka yaratildi: ${dir}`);
    }
  });

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  app.use(cookieParser());
  app.use(helmet({ contentSecurityPolicy: false }));
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const clientOrigin = process.env.CLIENT_ORIGIN || 'https://crm-oquv-markaz.vercel.app';

  app.enableCors({
    origin: (origin, callback) => {
      // Senior Level CORS: Faqatgina tasdiqlangan origin'larga ruxsat beramiz.
      // 1. Production frontend
      // 2. Localhost (development uchun)
      const allowedOrigins = [clientOrigin];
      const isLocalhost = origin && (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'));
      
      if (!origin || allowedOrigins.includes(origin) || isLocalhost) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: ${origin} bloklandi (Senior Security)`));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Branch-Subdomain',
    exposedHeaders: ['Authorization'], // Xavfsizlik uchun faqat kerakli headerlarni ko'rsatamiz
    maxAge: 3600,
  });

  const config = new DocumentBuilder()
    .setTitle('CRM Education API')
    .setDescription("O'quv markazi boshqaruv tizimi API hujjatlari")
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth('access_token')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const PORT = process.env.PORT || 3001;

  // Health check endpoint
  const expressInstance = app.getHttpAdapter().getInstance();
  expressInstance.get('/health', (req: any, res: any) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  await app.listen(PORT);

  console.log(`🚀 CRM Backend muvaffaqiyatli ishga tushdi!`);
  console.log(`🔗 Link: http://localhost:${PORT}`);
  console.log(`📚 Docs: http://localhost:${PORT}/api/docs`);
}

bootstrap();
