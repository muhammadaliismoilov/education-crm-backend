import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { Attendance } from 'src/entities/attendance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Attendance])],
  providers: [AttendanceService],
  controllers: [AttendanceController],
})
export class AttendanceModule {}