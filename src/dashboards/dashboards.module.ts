import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from 'src/entities/students.entity';
import { Payment } from 'src/entities/payment.entity';
import { Group } from 'src/entities/group.entity';
import { Attendance } from 'src/entities/attendance.entity';
import { DashboardService } from './dashboards.service';
import { DashboardController } from './dashboards.controller';

import { redisStore } from 'cache-manager-redis-yet';
import { CacheModule } from '@nestjs/cache-manager';

// ... boshqa importlar

@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: async () => ({
        store: await redisStore({
          url: `redis://${process.env.REDIS_HOST || 'localhost'}:6379`, // Docker-dagi redis nomi
          ttl: 600,
        }),
      }),
    }),
    TypeOrmModule.forFeature([Student, Payment, Group, Attendance]),
  ],
  controllers:[DashboardController],
  providers:[DashboardService],
  exports:[DashboardService]
  // ...
})
export class DashboardModule {}
