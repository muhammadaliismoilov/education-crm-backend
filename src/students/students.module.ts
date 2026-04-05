import { Module } from '@nestjs/common';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../entities/students.entity';
import { Group } from '../entities/group.entity';
import { StudentDiscount } from '../entities/studentDiscount';
import { FaceModule } from '../common/faceId/faceId.module';

import { StudentSubscriber } from './student.subscriber';

@Module({
  imports:[TypeOrmModule.forFeature([Student,Group,StudentDiscount]),FaceModule],
  controllers: [StudentsController],
  providers: [StudentsService, StudentSubscriber],
})
export class StudentsModule {}
