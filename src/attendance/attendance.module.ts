import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { Attendance } from '../entities/attendance.entity';
import { Group } from '../entities/group.entity';
import { FaceModule } from 'src/common/faceId/faceId.module';

@Module({
  imports: [TypeOrmModule.forFeature([Attendance,Group]),FaceModule],
  providers: [AttendanceService],
  controllers: [AttendanceController],
})
export class AttendanceModule {}