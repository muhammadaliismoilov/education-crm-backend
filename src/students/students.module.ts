import { Module } from '@nestjs/common';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from 'src/entities/students.entity';
import { Group } from 'src/entities/group.entity';
import { StudentDiscount } from 'src/entities/studentDiscount';

@Module({
  imports:[TypeOrmModule.forFeature([Student,Group,StudentDiscount])],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
