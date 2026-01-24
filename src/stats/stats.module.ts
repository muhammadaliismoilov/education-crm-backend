import { Module } from '@nestjs/common';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/entities/user.entity';

@Module({
  imports:[TypeOrmModule.forFeature([User])],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
