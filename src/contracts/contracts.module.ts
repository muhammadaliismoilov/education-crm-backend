import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { Contract } from '../entities/contract.entity';
import { Student } from '../entities/students.entity';
import { User } from '../entities/user.entity';
import { ContractTemplate } from '../entities/contract-template.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contract, Student, User, ContractTemplate]),
  ],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
