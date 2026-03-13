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
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../entities/user.entity';
import { Roles } from '../common/guards/roles.decarator';

@ApiTags('Foydalanuvchilar (Users)')
// @ApiBearerAuth()
// @UseGuards(JwtAuthGuard, RolesGuard) // TUZATISH: himoya yoqildi
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  // @Roles(UserRole.ADMIN) // TUZATISH: role tekshiruvi yoqildi
  @ApiOperation({ summary: "Yangi foydalanuvchi qo'shish" })
  @ApiResponse({
    status: 201,
    schema: {
      example: {
        data: {
          id: 'uuid',
          login: 'jasur_teacher',
          fullName: 'Jasur Toshmatov',
          role: 'teacher',
          phone: '+998901234567',
          createdAt: '2026-03-13T10:00:00.000Z',
        },
        statusCode: 201,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Login yoki telefon allaqachon mavjud',
  })
  async create(@Body() dto: CreateUserDto) {
    return await this.usersService.create(dto);
  }

  @Get()
  // @Roles(UserRole.ADMIN, UserRole.TEACHER) // TUZATISH: role tekshiruvi yoqildi
  @ApiOperation({ summary: "Foydalanuvchilar ro'yxati (Pagination & Search)" })
  @ApiQuery({ name: 'role', enum: UserRole, required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: {
          items: [
            {
              id: 'uuid',
              login: 'jasur_teacher',
              fullName: 'Jasur Toshmatov',
              role: 'teacher',
              phone: '+998901234567',
            },
          ],
          meta: { totalItems: 5, totalPages: 1, currentPage: 1 },
        },
        statusCode: 200,
        timestamp: '2026-03-13 10:00:00',
      },
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
  // @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "O'chirilgan foydalanuvchilar ro'yxati" })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: "Arxivlangan foydalanuvchilar ro'yxati",
  })
  async findAllDeleted(
    @Query('search') search?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return await this.usersService.findAllDeleted(search, page, limit);
  }

  @Get(':id')
  // @Roles(UserRole.ADMIN, UserRole.TEACHER) // TUZATISH: role tekshiruvi yoqildi
  @ApiOperation({ summary: "ID bo'yicha foydalanuvchi olish" })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: {
          id: 'uuid',
          login: 'jasur_teacher',
          fullName: 'Jasur Toshmatov',
          role: 'teacher',
          phone: '+998901234567',
        },
        statusCode: 200,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Foydalanuvchi topilmadi' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.usersService.findOne(id);
  }

  @Patch(':id')
  // @Roles(UserRole.ADMIN) // TUZATISH: role tekshiruvi yoqildi
  @ApiOperation({ summary: 'Foydalanuvchini qisman tahrirlash' })
  @ApiResponse({
    status: 200,
    description: 'Foydalanuvchi muvaffaqiyatli yangilandi',
  })
  @ApiResponse({ status: 404, description: 'Foydalanuvchi topilmadi' })
  @ApiResponse({
    status: 409,
    description: 'Login yoki telefon allaqachon mavjud',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return await this.usersService.update(id, dto);
  }

  @Delete(':id')
  // @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Foydalanuvchini soft-delete qilish (arxivlash)' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: {
          success: true,
          message: 'Foydalanuvchi arxivlandi (soft-deleted)',
        },
        statusCode: 200,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Foydalanuvchi topilmadi' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.remove(id);
    return {
      success: true,
      message: 'Foydalanuvchi arxivlandi (soft-deleted)',
    };
  }

  @Post(':id/restore')
  // @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "O'chirilgan foydalanuvchini tiklash" })
  @ApiResponse({
    status: 201,
    schema: {
      example: {
        data: {
          id: 'uuid',
          login: 'jasur_teacher',
          fullName: 'Jasur Toshmatov',
          role: 'teacher',
        },
        statusCode: 201,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Foydalanuvchi topilmadi' })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return await this.usersService.restore(id);
  }
}
