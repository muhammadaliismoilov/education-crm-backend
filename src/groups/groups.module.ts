import { Module } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from 'src/entities/group.entity';
import { User } from 'src/entities/user.entity';
import { Student } from 'src/entities/students.entity';

@Module({
  imports:[TypeOrmModule.forFeature([Group,User,Student])],
  controllers: [GroupsController],
  providers: [GroupsService],
})
export class GroupsModule {}
