import { Controller, Post, Body, Param, Get, ParseUUIDPipe, UseGuards, Patch, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CreateGroupDto, UpdateGroupDto } from './create-group.dto';


@ApiTags('Guruhlar (Groups)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  @ApiOperation({ summary: 'Barcha guruhlarni olish' })
  findAll() {
    return this.groupsService.findAll();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Guruhni tahrirlash' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGroupDto) {
    return this.groupsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Guruhni o\'chirish' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.remove(id);
  }

  @Delete(':groupId/remove-student/:studentId')
  @ApiOperation({ summary: 'Studentni guruhdan chiqarib yuborish' })
  removeStudent(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.groupsService.removeStudentFromGroup(groupId, studentId);
  }
}