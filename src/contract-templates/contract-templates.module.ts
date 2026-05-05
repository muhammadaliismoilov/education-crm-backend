import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractTemplatesController } from './contract-templates.controller';
import { ContractTemplatesService } from './contract-templates.service';
import { ContractTemplate } from '../entities/contract-template.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ContractTemplate])],
  controllers: [ContractTemplatesController],
  providers: [ContractTemplatesService],
})
export class ContractTemplatesModule {}
