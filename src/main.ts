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

  // SECURITY FIX: CSP faqat development da o'chiriladi (Swagger UI uchun).
  // Production da helmet to'liq ishlaydi.
  const isProduction = process.env.NODE_ENV === 'production';
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false,
    }),
  );

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

  // ─── CORS KONFIGURATSIYA (XAVFSIZ) ────────────────────────────────
  // SECURITY FIX: .includes() o'rniga .endsWith() ishlatiladi.
  // Sabab: origin.includes('crm.uz') — evil-crm.uz ham ruxsat oladi.
  // endsWith('.crm.uz') yoki === 'crm.uz' faqat aniq domenlarni qabul qiladi.
  const clientOriginConfig =
    process.env.CLIENT_ORIGIN || 'https://crm-oquv-markaz.vercel.app';
  const allowedOrigins = clientOriginConfig.split(',').map((o) => o.trim());

  // Ruxsat etilgan domen suffikslari (FAQAT shu domenlar va subdomenlariga ruxsat)
  const TRUSTED_DOMAIN_SUFFIXES = (
    process.env.TRUSTED_DOMAINS || 'bar-bers.uz,crm.uz'
  )
    .split(',')
    .map((d) => d.trim())
    .filter((d) => d.length > 0);

  /**
   * Domenni xavfsiz tekshirish.
   * "evil-crm.uz" kabi hujumlardan himoya qiladi.
   * Faqat aniq domen yoki uning subdomenlariga ruxsat beradi.
   */
  const isDomainTrusted = (origin: string): boolean => {
    try {
      const url = new URL(origin);
      const hostname = url.hostname;
      return TRUSTED_DOMAIN_SUFFIXES.some(
        (domain) =>
          hostname === domain || hostname.endsWith(`.${domain}`),
      );
    } catch {
      return false;
    }
  };

  app.enableCors({
    origin: (origin, callback) => {
      // SECURITY FIX: origin yo'q so'rovlar (curl, Postman, server-to-server)
      // production da bloklanadi. Faqat development da ruxsat beriladi.
      if (!origin) {
        if (!isProduction) {
          callback(null, true);
        } else {
          callback(
            new Error('CORS: Origin headersiz so\'rovlar production da bloklangan'),
          );
        }
        return;
      }

      // 1. Aniq ro'yxatdagi originlar (CLIENT_ORIGIN env variable'dan)
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      // 2. Localhost — faqat development uchun
      if (!isProduction) {
        const isLocalhost =
          origin.startsWith('http://localhost') ||
          origin.startsWith('http://127.0.0.1');
        if (isLocalhost) {
          callback(null, true);
          return;
        }
      }

      // 3. Ishonchli domen suffikslari — xavfsiz endsWith() tekshiruvi
      if (isDomainTrusted(origin)) {
        callback(null, true);
        return;
      }

      // Barchasi rad etildi
      logger.warn(`CORS bloklandi: ${origin}`);
      callback(new Error(`CORS: ${origin} bloklandi`));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Branch-Subdomain',
    exposedHeaders: ['Authorization'],
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
  // Swagger faqat development'da ochiq bo'lsin
  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.warn('⚠️  Swagger /api/docs — faqat development uchun ochiq!');
  } else {
    logger.log('🔒 Swagger production da yopiq.');
  }

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
