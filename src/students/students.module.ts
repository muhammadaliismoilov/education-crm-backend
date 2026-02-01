import { Module } from '@nestjs/common';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from 'src/entities/students.entity';
import { Group } from 'src/entities/group.entity';

@Module({
  imports:[TypeOrmModule.forFeature([Student,Group])],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
