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
  ApiParam,
} from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateGroupDto, UpdateGroupDto } from './group.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../entities/user.entity';
import { Roles } from '../common/guards/roles.decarator';

// ─── Reusable examples ───────────────────────────────────────────────────────

const GROUP_EXAMPLE = {
  id: 'bb096922-6249-4911-9a8c-9a503bb3e7d9',
  name: 'Node.js Backend',
  days: ['Dushanba', 'Chorshanba', 'Juma'],
  startTime: '14:00',
  endTime: '16:00',
  price: 800000,
  isActive: true,
  createdAt: '2026-03-13T10:00:00.000Z',
  updatedAt: '2026-03-13T10:00:00.000Z',
  deletedAt: null,
};

const TEACHER_EXAMPLE = {
  id: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
  fullName: 'Jasur Toshmatov',
  phone: '+998901234567',
  role: 'teacher',
};

const WRAP = (data: any, statusCode = 200) => ({
  data,
  statusCode,
  timestamp: '2026-03-13 10:00:00',
});

const NOT_FOUND = (msg = 'Guruh topilmadi') => ({
  statusCode: 404,
  message: msg,
  error: 'Not Found',
});

// ─────────────────────────────────────────────────────────────────────────────

@ApiTags('Guruhlar (Groups)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  // ─────────────────────────────────────────────
  // POST /groups
  // ─────────────────────────────────────────────
  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Yangi o'quv guruhi yaratish",
    description:
      "Yangi guruh yaratiladi. O'qituvchi bir xil kunda 2 soat ichida boshqa guruhga ega " +
      "bo'lsa conflict xatosi qaytariladi.",
  })
  @ApiResponse({
    status: 201,
    description: 'Guruh muvaffaqiyatli yaratildi',
    schema: {
      example: WRAP(
        {
          // TUZATISH: create teacher relation yuklamaydi —
          // faqat { id: teacherId } bo'ladi, fullName yo'q
          ...GROUP_EXAMPLE,
          teacher: { id: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8' },
        },
        201,
      ),
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

  // ─────────────────────────────────────────────
  // GET /groups
  // ─────────────────────────────────────────────
  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Barcha guruhlarni qidirish va sahifalab olish',
    description:
      "Guruh nomi bo'yicha qidiruv. Har bir guruhda talabalar soni ko'rsatiladi.",
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: "Guruh nomi bo'yicha qidiruv",
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiResponse({
    status: 200,
    description: "Guruhlar ro'yxati",
    schema: {
      example: WRAP({
        items: [
          {
            ...GROUP_EXAMPLE,
            // loadRelationCountAndMap bilan qo'shiladi
            studentsCount: 12,
            teacher: TEACHER_EXAMPLE,
          },
        ],
        meta: { totalItems: 5, totalPages: 1, currentPage: 1 },
      }),
    },
  })
  findAll(@Query('search') search?: string, @Query('page') page?: number) {
    return this.groupsService.findAll(search, Number(page) || 1);
  }

  // ─────────────────────────────────────────────
  // GET /groups/:id
  // ─────────────────────────────────────────────
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: "Guruh ma'lumotlari va talabalar ro'yxatini olish",
    description: 'teacher va students relation bilan birga qaytariladi.',
  })
  @ApiParam({ name: 'id', description: 'Guruh UUID si', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: "Guruh to'liq ma'lumotlari",
    schema: {
      example: WRAP({
        ...GROUP_EXAMPLE,
        teacher: TEACHER_EXAMPLE,
        // TUZATISH: getGroupDetails students relation yuklab beradi
        students: [
          {
            id: 'uuid',
            fullName: 'Alisher Karimov',
            phone: '+998901234567',
            balance: 500000,
          },
        ],
      }),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Guruh topilmadi',
    schema: { example: NOT_FOUND() },
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.getGroupDetails(id);
  }

  // ─────────────────────────────────────────────
  // PATCH /groups/:id
  // ─────────────────────────────────────────────
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Guruh sozlamalarini tahrirlash',
    description:
      "Vaqt, kun yoki o'qituvchi o'zgarsa conflict tekshiruvi qayta bajariladi.",
  })
  @ApiParam({ name: 'id', description: 'Guruh UUID si', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Guruh muvaffaqiyatli yangilandi',
    schema: {
      example: WRAP({
        // TUZATISH: update getGroupDetails dan keyin save qaytaradi —
        // teacher va students relation bor
        ...GROUP_EXAMPLE,
        teacher: TEACHER_EXAMPLE,
        students: [
          { id: 'uuid', fullName: 'Alisher Karimov', phone: '+998901234567' },
        ],
      }),
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
  @ApiResponse({
    status: 404,
    description: 'Guruh topilmadi',
    schema: { example: NOT_FOUND() },
  })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGroupDto) {
    return this.groupsService.update(id, dto);
  }

  // ─────────────────────────────────────────────
  // DELETE /groups/:id
  // ─────────────────────────────────────────────
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Guruhni arxivga o'tkazish (Soft-delete)",
    description: "Guruh o'chirilmaydi, arxivlanadi.",
  })
  @ApiParam({ name: 'id', description: 'Guruh UUID si', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Guruh muvaffaqiyatli arxivlandi',
    schema: {
      example: WRAP({ message: 'Guruh arxivlandi' }),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Guruh topilmadi',
    schema: { example: NOT_FOUND() },
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.remove(id);
  }

  // ─────────────────────────────────────────────
  // POST /groups/:groupId/add-student/:studentId
  // ─────────────────────────────────────────────
  @Post(':groupId/add-student/:studentId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Talabani guruh a'zolari qatoriga qo'shish",
  })
  @ApiParam({ name: 'groupId', description: 'Guruh UUID si', format: 'uuid' })
  @ApiParam({
    name: 'studentId',
    description: 'Talaba UUID si',
    format: 'uuid',
  })
  @ApiResponse({
    status: 201,
    description: "Talaba guruhga muvaffaqiyatli qo'shildi",
    schema: {
      example: WRAP({ message: "Student guruhga qo'shildi" }, 201),
    },
  })
  @ApiResponse({
    status: 400,
    description: "O'quvchi allaqachon guruhda bor",
    schema: {
      example: {
        statusCode: 400,
        message: "O'quvchi allaqachon guruhda bor",
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Guruh yoki talaba topilmadi',
    schema: { example: NOT_FOUND('Talaba topilmadi') },
  })
  addStudent(
    @Param('groupId', ParseUUIDPipe) gId: string,
    @Param('studentId', ParseUUIDPipe) sId: string,
  ) {
    return this.groupsService.addStudentToGroup(gId, sId);
  }

  // ─────────────────────────────────────────────
  // DELETE /groups/:groupId/remove-student/:studentId
  // ─────────────────────────────────────────────
  @Delete(':groupId/remove-student/:studentId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Talabani guruhdan chiqarish',
  })
  @ApiParam({ name: 'groupId', description: 'Guruh UUID si', format: 'uuid' })
  @ApiParam({
    name: 'studentId',
    description: 'Talaba UUID si',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Talaba guruhdan muvaffaqiyatli olib tashlandi',
    schema: {
      example: WRAP({
        // TUZATISH: service { message: 'Talaba guruhdan muvaffaqiyatli chetlatildi' }
        // qaytaradi — avvalgi description da faqat matn bor edi, example yo'q
        message: 'Talaba guruhdan muvaffaqiyatli chetlatildi',
      }),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Guruh yoki talaba topilmadi',
    schema: { example: NOT_FOUND('Bu talaba ushbu guruhda topilmadi') },
  })
  removeStudent(
    @Param('groupId', ParseUUIDPipe) gId: string,
    @Param('studentId', ParseUUIDPipe) sId: string,
  ) {
    return this.groupsService.removeStudentFromGroup(gId, sId);
  }
}
