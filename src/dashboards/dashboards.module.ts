import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from 'src/entities/students.entity';
import { Payment } from 'src/entities/payment.entity';
import { Group } from 'src/entities/group.entity';
import { Attendance } from 'src/entities/attendance.entity';
import { DashboardService } from './dashboards.service';
import { DashboardController } from './dashboards.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Student, Payment, Group, Attendance]),
  ],
  controllers:[DashboardController],
  providers:[DashboardService],
  exports:[DashboardService]

})
export class DashboardModule {}
