import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { SalaryModule } from './salarys/salary.module';
import { AuthModule } from './auth/auth.module';
import { GroupsModule } from './groups/groups.module';
import { AttendanceModule } from './attendance/attendance.module';
import { PaymentModule } from './payment/payment.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { SubdomainMiddleware } from './common/middleware/subdomain.middleware';
import { StudentsModule } from './students/students.module';
import { ReportsModule } from './reports/reports.module';
import { DashboardModule } from './dashboards/dashboards.module';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { CronModule } from './cron/cron.module';
import { FaceModule } from './common/faceId/faceId.module';
import { BranchesModule } from './branches/branches.module';
import { ExpensesModule } from './expenses/expenses.module';
import { Branch } from './entities/branch.entity';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { IpWhitelistGuard } from './common/guards/ip-whitelist.guard';
import { ContractsModule } from './contracts/contracts.module';
import { ContractTemplatesModule } from './contract-templates/contract-templates.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          url: `redis://${configService.get('REDIS_HOST') || 'localhost'}:6379`,
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          ttl: 600,
        }),
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: parseInt(configService.get<string>('DB_PORT'), 10),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASS'),
        database: configService.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: true, //process.env.NODE_ENV !== 'production', // Production'da XAVFLI — migratsiya ishlating!
      }),
    }),
    TypeOrmModule.forFeature([Branch]),
    AuthModule,
    UsersModule,
    BranchesModule,
    StudentsModule,
    GroupsModule,
    AttendanceModule,
    SalaryModule,
    PaymentModule,
    ReportsModule,
    DashboardModule,
    ExpensesModule,
    CronModule,
    FaceModule,
    ContractsModule,
    ContractTemplatesModule,
  ],
  providers: [
    SubdomainMiddleware,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: IpWhitelistGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware, SubdomainMiddleware).forRoutes('*');
  }
}
