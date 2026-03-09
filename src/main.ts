// import { NestFactory } from '@nestjs/core';
// import { ValidationPipe } from '@nestjs/common';
// import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
// import { AppModule } from './app.module';
// import cookieParser from 'cookie-parser';
// import { TransformInterceptor } from './common/interceptors/transform.interceptor';
// import { AllExceptionsFilter } from './common/filters/http-exception.filter';
// import { NestExpressApplication } from '@nestjs/platform-express'; //
// import { join } from 'path';

// async function bootstrap() {
//   const app = await NestFactory.create<NestExpressApplication>(AppModule);

//   // 'uploads' papkasini static qilish (http://localhost:3001/uploads/students/file.jpg)
//   // app.useStaticAssets(join(__dirname, '..', 'uploads'), {
//   //   prefix: '/uploads/',
//   // });

//   app.useStaticAssets(join(__dirname, '..', 'uploads'), {
//     prefix: '/uploads/',
//   });

//   // 1. Cookie Parser
//   app.use(cookieParser());

//   // 2. Global Interceptor (Muvaffaqiyatli javoblar uchun)
//   app.useGlobalInterceptors(new TransformInterceptor());

//   // 3. Global Exception Filter (Xatoliklar uchun)
//   app.useGlobalFilters(new AllExceptionsFilter());

//   // 4. Global Validation
//   app.useGlobalPipes(
//     new ValidationPipe({
//       whitelist: true,
//       transform: true,
//       forbidNonWhitelisted: true,
//     }),
//   );

//   // 5. CORS sozlamalari (Frontend ulanishi uchun)
//   app.enableCors({
//     origin: ['https://crm-oquv-markaz.vercel.app', 'http://localhost:5173'],
//     methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
//     credentials: true,
//     allowedHeaders: 'Content-Type, Accept, Authorization',
//   });

//   // 6. Swagger sozlamalari
//   const config = new DocumentBuilder()
//     .setTitle('CRM Education API')
//     .setDescription("O'quv markazi boshqaruv tizimi API hujjatlari")
//     .setVersion('1.0')
//     .addBearerAuth()
//     .addCookieAuth('access_token')
//     .build();

//   const document = SwaggerModule.createDocument(app, config);
//   SwaggerModule.setup('api/docs', app, document);

//   const PORT = process.env.PORT || 3001;
//   await app.listen(PORT);

//   console.log(`\n🚀 CRM Backend muvaffaqiyatli ishga tushdi!`);
//   console.log(`🔗 Link: http://localhost:${PORT}`);
//   console.log(`📚 Docs: http://localhost:${PORT}/api/docs\n`);
// }
// bootstrap();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as fs from 'fs';
import * as express from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // ✅ Kerakli papkalarni avtomatik yaratish
  const requiredDirs = ['uploads/students', 'uploads/students/tmp'];
  requiredDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.log(`📁 Papka yaratildi: ${dir}`);
    }
  });

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

    app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  // ✅ Static fayllar — uploads papkasi
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // ✅ Cookie Parser
  app.use(cookieParser());

  // ✅ Global Interceptor
  app.useGlobalInterceptors(new TransformInterceptor());

  // ✅ Global Exception Filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // ✅ Global Validation
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

  // ✅ CORS
  app.enableCors({
    origin: ['https://crm-oquv-markaz.vercel.app', 'http://localhost:5173'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  // ✅ Swagger
  const config = new DocumentBuilder()
    .setTitle('CRM Education API')
    .setDescription("O'quv markazi boshqaruv tizimi API hujjatlari")
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth('access_token')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // ✅ Token saqlanib qoladi
     
    },
  });

  const PORT = process.env.PORT || 3001;
  await app.listen(PORT);

  console.log(`🚀 CRM Backend muvaffaqiyatli ishga tushdi!`);
  console.log(`🔗 Link: http://localhost:${PORT}`);
  console.log(`📚 Docs: http://localhost:${PORT}/api/docs`);
}

bootstrap();
