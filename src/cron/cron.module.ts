// src/cron/cron.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CronService } from './cron.service';
import { Student } from '../entities/students.entity';
import { StudentDiscount } from '../entities/studentDiscount';


@Module({
  imports: [
    TypeOrmModule.forFeature([Student,StudentDiscount]),
  ],
  providers: [CronService],
  exports: [CronService], // Agar boshqa modullarda kerak bo'lsa
})
export class CronModule {}