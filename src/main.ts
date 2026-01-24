import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import  cookieParser from 'cookie-parser'; // 1. Import qilish

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser()); // 2. Cookie-larni tanish uchun

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  
  const PORT = process.env.PORT || 3000;

  const config = new DocumentBuilder()
    .setTitle('CRM Education API')
    .setVersion('1.0')
    .addBearerAuth()
    // .addCookieAuth('access_token') // Cookie orqali auth uchun
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(PORT);
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📖 Swagger docs: http://localhost:${PORT}/api/docs`);
}
bootstrap();