import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { User } from 'src/entities/user.entity';
import { Payment } from 'src/entities/payment.entity';
import { SalaryPayout } from 'src/entities/salaryPayout.entity';


@Module({
  imports: [TypeOrmModule.forFeature([User, Payment,SalaryPayout])],
  controllers: [FinanceController],
  providers: [FinanceService],
})
export class FinanceModule {}