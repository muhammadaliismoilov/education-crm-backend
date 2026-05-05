import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { Contract } from '../entities/contract.entity';
import { Student } from '../entities/students.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Contract, Student, User])],
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
