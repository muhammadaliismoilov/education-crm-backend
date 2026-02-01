import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalaryService } from './salary.service';
import { SalaryController } from './salary.controller';
import { User } from 'src/entities/user.entity';
import { Payment } from 'src/entities/payment.entity';
import { SalaryPayout } from 'src/entities/salaryPayout.entity';
import { Attendance } from 'src/entities/attendance.entity';


@Module({
  imports: [TypeOrmModule.forFeature([User, Payment,SalaryPayout,Attendance])],
  controllers: [SalaryController],
  providers: [SalaryService],
})
export class SalaryModule {}