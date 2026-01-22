import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import { UserRole } from 'src/entities/user.entity';


@ApiTags('Foydalanuvchilar (Adminlar, O\'qituvchilar, O\'quvchilar)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Yangi foydalanuvchi yaratish' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get('admins')
  @ApiOperation({ summary: 'Adminlarni qidirish' })
  @ApiQuery({ name: 'search', required: false })
  findAdmins(@Query('search') search: string) {
    return this.usersService.findAll(UserRole.ADMIN, search);
  }

  @Get('teachers')
  @ApiOperation({ summary: 'O\'qituvchilarni qidirish' })
  @ApiQuery({ name: 'search', required: false })
  findTeachers(@Query('search') search: string) {
    return this.usersService.findAll(UserRole.TEACHER, search);
  }

  @Get('students')
  @ApiOperation({ summary: 'O\'quvchilarni qidirish' })
  @ApiQuery({ name: 'search', required: false })
  findStudents(@Query('search') search: string) {
    return this.usersService.findAll(UserRole.STUDENT, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'ID bo\'yicha olish' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ma\'lumotlarni tahrirlash' })
  update(@Param('id') id: string, @Body() dto: Partial<UpdateUserDto>) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Foydalanuvchini o\'chirish' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}