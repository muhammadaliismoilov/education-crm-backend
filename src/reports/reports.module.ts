import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Student } from '../entities/students.entity';
import { Payment } from '../entities/payment.entity';
import { Group } from '../entities/group.entity';
import { Attendance } from '../entities/attendance.entity';
import { User } from '../entities/user.entity';
import { SalaryModule } from '../salarys/salary.module';
import { RedisCacheService } from '../common/redis/redis.cache';

@Module({
  imports: [
    SalaryModule,
    TypeOrmModule.forFeature([Student, Payment, Group, Attendance, User]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, RedisCacheService],
  exports: [ReportsService],
})
export class ReportsModule {}
