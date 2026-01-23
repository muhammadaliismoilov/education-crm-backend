import { 
  Controller, Get, Post, Body, Patch, Param, Delete, 
  Query, UseGuards, ParseUUIDPipe 
} from '@nestjs/common';
import { 
  ApiTags, ApiOperation, ApiQuery, ApiBearerAuth, ApiResponse 
} from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CreateGroupDto, UpdateGroupDto } from './create-group.dto';


@ApiTags('Guruhlar (Groups)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @ApiOperation({ summary: 'Yangi guruh yaratish' })
  @ApiResponse({ status: 201, description: 'Guruh muvaffaqiyatli yaratildi.' })
  create(@Body() dto: CreateGroupDto) {
    return this.groupsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Barcha guruhlarni olish va nomi bo\'yicha qidirish' })
  @ApiQuery({ name: 'search', required: false, description: 'Guruh nomi bo\'yicha qidiruv' })
  findAll(@Query('search') search?: string) {
    return this.groupsService.findAll(search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Guruh ma\'lumotlarini ID bo\'yicha olish' })
  getGroupDetails(@Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.getGroupDetails(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Guruh ma\'lumotlarini tahrirlash' })
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() dto: UpdateGroupDto
  ) {
    return this.groupsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Guruhni o\'chirish' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.remove(id);
  }

  @Post(':groupId/add-student/:studentId')
  @ApiOperation({ summary: 'Studentni guruhga qo\'shish' })
  addStudent(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.groupsService.addStudentToGroup(groupId, studentId);
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