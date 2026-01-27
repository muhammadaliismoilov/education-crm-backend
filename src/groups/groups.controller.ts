import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CreateGroupDto, UpdateGroupDto } from './create-group.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from 'src/entities/user.entity';
import { Roles } from 'src/common/guards/roles.decarator';

@ApiTags('Guruhlar (Groups)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Yangi o‘quv guruhi yaratish' })
  create(@Body() dto: CreateGroupDto) {
    return this.groupsService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Barcha guruhlarni qidirish va sahifalab olish' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Guruh nomi bo‘yicha qidiruv',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Sahifa raqami' })
  findAll(@Query('search') search?: string, @Query('page') page?: number) {
    return this.groupsService.findAll(search, Number(page) || 1);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Guruh ma’lumotlari va talabalar ro‘yxatini olish' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.getGroupDetails(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Guruh sozlamalarini (vaqt, o‘qituvchi, narx) tahrirlash',
  })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGroupDto) {
    return this.groupsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Guruhni arxivga o‘tkazish (Soft-delete)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.remove(id);
  }

  @Post(':groupId/add-student/:studentId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Talabani guruh a’zolari qatoriga qo‘shish' })
  addStudent(
    @Param('groupId', ParseUUIDPipe) gId: string,
    @Param('studentId', ParseUUIDPipe) sId: string,
  ) {
    return this.groupsService.addStudentToGroup(gId, sId);
  }

  @Delete(':groupId/remove-student/:studentId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Talabani guruh a’zolari ro‘yxatidan chiqarish (chetlatish)',
  })
  @ApiResponse({
    status: 200,
    description: 'Talaba guruhdan muvaffaqiyatli olib tashlandi',
  })
  @ApiResponse({ status: 404, description: 'Guruh yoki talaba topilmadi' })
  removeStudent(
    @Param('groupId', ParseUUIDPipe) gId: string,
    @Param('studentId', ParseUUIDPipe) sId: string,
  ) {
    return this.groupsService.removeStudentFromGroup(gId, sId);
  }
}
