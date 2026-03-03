// src/cron/cron.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CronService } from './cron.service';
import { Student } from 'src/entities/students.entity';


@Module({
  imports: [
    // Student repository'dan foydalanish uchun import qilamiz
    TypeOrmModule.forFeature([Student]),
  ],
  providers: [CronService],
  exports: [CronService], // Agar boshqa modullarda kerak bo'lsa
})
export class CronModule {}