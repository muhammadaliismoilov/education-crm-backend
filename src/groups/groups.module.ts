import { Module } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from 'src/entities/groupe.entity';
import { User } from 'src/entities/user.entity';

@Module({
  imports:[TypeOrmModule.forFeature([Group,User])],
  controllers: [GroupsController],
  providers: [GroupsService],
})
export class GroupsModule {}
