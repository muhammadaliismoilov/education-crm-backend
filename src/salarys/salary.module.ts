import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalaryService } from './salary.service';
import { SalaryController } from './salary.controller';
import { User } from '../entities/user.entity';
import { Payment } from '../entities/payment.entity';
import { SalaryPayout } from '../entities/salaryPayout.entity';
import { Attendance } from '../entities/attendance.entity';


@Module({
  imports: [TypeOrmModule.forFeature([User, Payment,SalaryPayout,Attendance])],
  controllers: [SalaryController],
  providers: [SalaryService],
  exports:[SalaryService]
})
export class SalaryModule {}