import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as redisStore from 'cache-manager-redis-yet';

import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Student } from '../entities/students.entity';
import { Payment } from '../entities/payment.entity';
import { Group } from '../entities/group.entity';
import { Attendance } from '../entities/attendance.entity';

@Module({
  imports: [
    CacheModule.register({
      store: redisStore.redisStore, 
      host: 'redis',
      port: 6379,
      ttl: 900000, // Kesh muddati (15 daqiqa)
    }),
    TypeOrmModule.forFeature([Student, Payment, Group, Attendance]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService], 
})
export class ReportsModule {}