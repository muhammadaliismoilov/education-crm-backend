import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { User } from 'src/entities/user.entity';
import { Payment } from 'src/entities/payment.entity';
import { SalaryPayout } from 'src/entities/salaryPayout.entity';
import { Attendance } from 'src/entities/attendance.entity';


@Module({
  imports: [TypeOrmModule.forFeature([User, Payment,SalaryPayout,Attendance])],
  controllers: [FinanceController],
  providers: [FinanceService],
})
export class FinanceModule {}