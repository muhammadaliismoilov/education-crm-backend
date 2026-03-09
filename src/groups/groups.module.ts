import { Module } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from '../entities/group.entity';
import { User } from '../entities/user.entity';
import { Student } from '../entities/students.entity';

@Module({
  imports:[TypeOrmModule.forFeature([Group,User,Student])],
  controllers: [GroupsController],
  providers: [GroupsService],
})
export class GroupsModule {}
