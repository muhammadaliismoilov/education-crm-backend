// // src/main.ts
// import { NestFactory } from '@nestjs/core';
// import { ValidationPipe } from '@nestjs/common';
// import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
// import { AppModule } from './app.module';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);

//   // Validation uchun global pipe
//   app.useGlobalPipes(new ValidationPipe());

//   // Swagger dokumentatsiyasi
//   const config = new DocumentBuilder()
//     .setTitle('Education CRM API')
//     .setDescription('Oquv markazi uchun CRM tizimi API-lari')
//     .setVersion('1.0')
//     .addBearerAuth()
//     .build();
//   const document = SwaggerModule.createDocument(app, config);
//   SwaggerModule.setup('api', app, document);

//   await app.listen(3000);
// }
// bootstrap();

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

// import { NestFactory } from '@nestjs/core';
// import { ValidationPipe } from '@nestjs/common';
// import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
// import { AppModule } from './app.module';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);

//   app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
//  const PORT = process.env.PORT || 4000;
//   const config = new DocumentBuilder()
//     .setTitle('CRM Education API')
//     .setVersion('1.0')
//     .addBearerAuth()
//     .build();
//   const document = SwaggerModule.createDocument(app, config);
//   SwaggerModule.setup('docs', app, document);

//   // // --- SUPER ADMIN SEEDING ---
//   // const userRepo = app.get(getRepositoryToken(User));
//   // const adminExists = await userRepo.findOne({ where: { role: UserRole.ADMIN } });
  
//   // if (!adminExists) {
//   //   const hashedPassword = await bcrypt.hash('admin777', 10);
//   //   const superAdmin = userRepo.create({
//   //     fullName: 'Super Admin',
//   //     phone: '+998901234567',
//   //     login: 'admin',
//   //     password: hashedPassword,
//   //     role: UserRole.ADMIN,
//   //     salaryPercentage: 0
//   //   });
//   //   await userRepo.save(superAdmin);
//   //   console.log('✅ Super Admin yaratildi: login: admin, parol: admin777');
//   // }
//   // // ---------------------------

//   await app.listen(3000);
//   console.log(`🚀 Server is running on http://localhost:${PORT}`);
//   console.log(`📖 Swagger docs: http://localhost:${PORT}/api/docs`);
// }
// bootstrap();
