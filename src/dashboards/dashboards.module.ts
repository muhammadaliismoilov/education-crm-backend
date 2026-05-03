import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../entities/students.entity';
import { Payment } from '../entities/payment.entity';
import { Group } from '../entities/group.entity';
import { Attendance } from '../entities/attendance.entity';
import { DashboardService } from './dashboards.service';
import { DashboardController } from './dashboards.controller';
import { ExpensesModule } from '../expenses/expenses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Student, Payment, Group, Attendance]),
    ExpensesModule, // ExpensesService inject qilish uchun
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
