import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Student } from '../entities/students.entity';
import { Payment } from '../entities/payment.entity';
import { Group } from '../entities/group.entity';
import { Attendance } from '../entities/attendance.entity';
import { User } from 'src/entities/user.entity';
import { SalaryModule } from 'src/salarys/salary.module';

@Module({
  imports: [SalaryModule,TypeOrmModule.forFeature([Student, Payment, Group, Attendance,User])],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
