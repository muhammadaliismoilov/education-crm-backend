import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global Validation
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const PORT = process.env.PORT || 4000;
  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('CRM Education API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(PORT);
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📖 Swagger docs: http://localhost:${PORT}/api/docs`);
}
bootstrap();
