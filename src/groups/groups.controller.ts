// groups.controller.ts
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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateGroupDto, UpdateGroupDto } from './group.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../entities/user.entity';
import { Roles } from '../common/guards/roles.decarator';

@ApiTags('Guruhlar (Groups)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Yangi o'quv guruhi yaratish" })
  @ApiResponse({
    status: 201,
    description: 'Guruh muvaffaqiyatli yaratildi',
    schema: {
      example: {
        data: {
          id: 'bb096922-6249-4911-9a8c-9a503bb3e7d9',
          name: 'Node.js Backend',
          days: ['Dushanba', 'Chorshanba', 'Juma'],
          startTime: '14:00',
          endTime: '16:00',
          price: 800000,
          teacher: { id: 'teacher-uuid' },
          createdAt: '2026-03-13T10:00:00.000Z',
        },
        statusCode: 201,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "O'qituvchi bu vaqtda band",
    schema: {
      example: {
        statusCode: 400,
        message: 'O\'qituvchi bu vaqtda band. "Python" guruhi bor (14:00).',
        error: 'Bad Request',
      },
    },
  })
  create(@Body() dto: CreateGroupDto) {
    return this.groupsService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Barcha guruhlarni qidirish va sahifalab olish' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: "Guruh nomi bo'yicha qidiruv",
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: {
          items: [
            {
              id: 'bb096922-6249-4911-9a8c-9a503bb3e7d9',
              name: 'Node.js Backend',
              days: ['Dushanba', 'Chorshanba'],
              startTime: '14:00',
              endTime: '16:00',
              price: 800000,
              studentsCount: 12,
              teacher: { id: 'uuid', fullName: 'Jasur Toshmatov' },
            },
          ],
          meta: { totalItems: 5, totalPages: 1, currentPage: 1 },
        },
        statusCode: 200,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  findAll(@Query('search') search?: string, @Query('page') page?: number) {
    return this.groupsService.findAll(search, Number(page) || 1);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: "Guruh ma'lumotlari va talabalar ro'yxatini olish" })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: {
          id: 'bb096922-6249-4911-9a8c-9a503bb3e7d9',
          name: 'Node.js Backend',
          days: ['Dushanba', 'Chorshanba'],
          startTime: '14:00',
          endTime: '16:00',
          price: 800000,
          teacher: { id: 'uuid', fullName: 'Jasur Toshmatov' },
          students: [
            { id: 'uuid', fullName: 'Alisher Karimov', phone: '+998901234567' },
          ],
        },
        statusCode: 200,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Guruh topilmadi' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.getGroupDetails(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Guruh sozlamalarini tahrirlash' })
  @ApiResponse({ status: 200, description: 'Guruh muvaffaqiyatli yangilandi' })
  @ApiResponse({ status: 404, description: 'Guruh topilmadi' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGroupDto) {
    return this.groupsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Guruhni arxivga o'tkazish (Soft-delete)" })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: { message: 'Guruh arxivlandi' },
        statusCode: 200,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Guruh topilmadi' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.remove(id);
  }

  @Post(':groupId/add-student/:studentId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Talabani guruh a'zolari qatoriga qo'shish" })
  @ApiResponse({
    status: 201,
    schema: {
      example: {
        data: { message: "Student guruhga qo'shildi" },
        statusCode: 201,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  @ApiResponse({ status: 400, description: "O'quvchi allaqachon guruhda bor" })
  @ApiResponse({ status: 404, description: 'Guruh yoki talaba topilmadi' })
  addStudent(
    @Param('groupId', ParseUUIDPipe) gId: string,
    @Param('studentId', ParseUUIDPipe) sId: string,
  ) {
    return this.groupsService.addStudentToGroup(gId, sId);
  }

  @Delete(':groupId/remove-student/:studentId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Talabani guruhdan chiqarish' })
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
