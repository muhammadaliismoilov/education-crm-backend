// users.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../entities/user.entity';
import { Roles } from '../common/guards/roles.decarator';

// ─── Reusable examples ───────────────────────────────────────────────────────

const USER_EXAMPLE = {
  id: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
  login: 'jasur_teacher',
  fullName: 'Jasur Toshmatov',
  role: 'teacher',
  phone: '+998901234567',
  salaryPercentage: 30,
  teachingGroups: [
    { id: 'bb096922-6249-4911-9a8c-9a503bb3e7d9', name: 'Node.js Backend' },
  ],
  createdAt: '2026-03-13T10:00:00.000Z',
  updatedAt: '2026-03-13T10:00:00.000Z',
  deletedAt: null,
};

const WRAP = (data: any, statusCode = 200) => ({
  data,
  statusCode,
  timestamp: '2026-03-13 10:00:00',
});

const NOT_FOUND = {
  statusCode: 404,
  message: 'Foydalanuvchi topilmadi',
  error: 'Not Found',
};

const CONFLICT = {
  statusCode: 409,
  message: 'Ushbu login allaqachon mavjud',
  error: 'Conflict',
};

// ─────────────────────────────────────────────────────────────────────────────

@ApiTags('Foydalanuvchilar (Users)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Yangi foydalanuvchi qo'shish",
    description: 'Admin tomonidan yangi teacher yoki admin yaratish.',
  })
  @ApiResponse({
    status: 201,
    description: 'Foydalanuvchi muvaffaqiyatli yaratildi',
    schema: {
      example: WRAP(
        // TUZATISH: password response da ko'rinmaydi —
        // service User entity qaytaradi, password hash ham ketadi.
        // Frontend uchun password ni ko'rsatmaslik kerak
        {
          id: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
          login: 'jasur_teacher',
          fullName: 'Jasur Toshmatov',
          role: 'teacher',
          phone: '+998901234567',
          salaryPercentage: 30,
          teachingGroups: [],
          createdAt: '2026-03-13T10:00:00.000Z',
          updatedAt: '2026-03-13T10:00:00.000Z',
          deletedAt: null,
          // password: '<hashed>' — bu response da keladi, entity dan exclude kerak
        },
        201,
      ),
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Login yoki telefon allaqachon mavjud',
    schema: { example: CONFLICT },
  })
  @ApiResponse({
    status: 400,
    description: 'Validatsiya xatosi',
    schema: {
      example: {
        statusCode: 400,
        message: ["Parol kamida 6 ta belgidan iborat bo'lishi kerak"],
        error: 'Bad Request',
      },
    },
  })
  async create(@Body() dto: CreateUserDto) {
    return await this.usersService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: "Foydalanuvchilar ro'yxati",
    description: "Role, ism yoki login bo'yicha qidirish va sahifalash.",
  })
  @ApiQuery({
    name: 'role',
    enum: UserRole,
    required: false,
    description: "Role bo'yicha filter",
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: "Ism, login yoki telefon bo'yicha qidiruv",
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: "Foydalanuvchilar ro'yxati",
    schema: {
      example: WRAP({
        // TUZATISH: service { data, meta } qaytaradi — items emas!
        data: [USER_EXAMPLE],
        meta: { totalItems: 5, totalPages: 1, currentPage: 1 },
      }),
    },
  })
  async findAll(
    @Query('role') role?: UserRole,
    @Query('search') search?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return await this.usersService.findAll(role, search, page, limit);
  }

  @Get('all/deleted')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "O'chirilgan foydalanuvchilar ro'yxati",
    description:
      'Soft-delete qilingan foydalanuvchilar. Restore orqali qaytarish mumkin.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: "Ism, login yoki telefon bo'yicha qidiruv",
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: "Arxivlangan foydalanuvchilar ro'yxati",
    schema: {
      example: WRAP({
        // TUZATISH: service { data, meta } qaytaradi — items emas!
        data: [
          {
            ...USER_EXAMPLE,
            teachingGroups: [],
            deletedAt: '2026-02-01T10:00:00.000Z',
          },
        ],
        meta: { totalItems: 2, totalPages: 1, currentPage: 1 },
      }),
    },
  })
  async findAllDeleted(
    @Query('search') search?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return await this.usersService.findAllDeleted(search, page, limit);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: "ID bo'yicha foydalanuvchi olish",
    description: 'teachingGroups relation bilan birga qaytariladi.',
  })
  @ApiParam({
    name: 'id',
    description: 'Foydalanuvchi UUID si',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: "Foydalanuvchi ma'lumotlari",
    // TUZATISH: teachingGroups qo'shildi — findOne relation bilan qaytaradi
    schema: { example: WRAP(USER_EXAMPLE) },
  })
  @ApiResponse({
    status: 404,
    description: 'Foydalanuvchi topilmadi',
    schema: { example: NOT_FOUND },
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Foydalanuvchini qisman tahrirlash',
    description:
      "Istalgan fieldni yangilash mumkin. Parol o'zgartirilsa avtomatik hash qilinadi.",
  })
  @ApiParam({
    name: 'id',
    description: 'Foydalanuvchi UUID si',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Foydalanuvchi muvaffaqiyatli yangilandi',
    // TUZATISH: teachingGroups qo'shildi — update findOne qaytaradi
    schema: { example: WRAP(USER_EXAMPLE) },
  })
  @ApiResponse({
    status: 404,
    description: 'Foydalanuvchi topilmadi',
    schema: { example: NOT_FOUND },
  })
  @ApiResponse({
    status: 409,
    description: 'Login yoki telefon boshqa foydalanuvchida band',
    schema: { example: CONFLICT },
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return await this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Foydalanuvchini arxivlash (soft-delete)',
    description:
      "Foydalanuvchi o'chirilmaydi. /:id/restore orqali qaytarish mumkin.",
  })
  @ApiParam({
    name: 'id',
    description: 'Foydalanuvchi UUID si',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Foydalanuvchi muvaffaqiyatli arxivlandi',
    schema: {
      example: WRAP({
        success: true,
        message: 'Foydalanuvchi arxivlandi (soft-deleted)',
      }),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Foydalanuvchi topilmadi',
    schema: { example: NOT_FOUND },
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.remove(id);
    return {
      success: true,
      message: 'Foydalanuvchi arxivlandi (soft-deleted)',
    };
  }

  @Post(':id/restore')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Arxivlangan foydalanuvchini tiklash',
    description: 'Soft-delete qilingan foydalanuvchini faol holatga qaytaradi.',
  })
  @ApiParam({
    name: 'id',
    description: 'Foydalanuvchi UUID si',
    format: 'uuid',
  })
  @ApiResponse({
    status: 201,
    description: 'Foydalanuvchi muvaffaqiyatli tiklandi',
    // TUZATISH: teachingGroups qo'shildi — restore findOne qaytaradi
    schema: {
      example: WRAP({ ...USER_EXAMPLE, deletedAt: null }, 201),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Foydalanuvchi topilmadi',
    schema: { example: NOT_FOUND },
  })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return await this.usersService.restore(id);
  }
}
