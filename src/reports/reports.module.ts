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
import { ExpensesModule } from '../expenses/expenses.module';

import { Expense } from '../entities/expense.entity';

@Module({
  imports: [
    SalaryModule,
    ExpensesModule,
    TypeOrmModule.forFeature([Student, Payment, Group, Attendance, User, Expense]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, RedisCacheService],
  exports: [ReportsService],
})
export class ReportsModule {}
