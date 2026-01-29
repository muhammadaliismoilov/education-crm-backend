import { 
  Controller, Get, Post, Patch, Delete, 
  Body, Param, Query, UseGuards, ParseUUIDPipe 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from 'src/entities/user.entity';
import { Roles } from 'src/common/guards/roles.decarator';


@ApiTags('Foydalanuvchilar (Users)')
// @ApiBearerAuth()
// @UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  // @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Yangi foydalanuvchi qo\'shish' })
  async create(@Body() dto: CreateUserDto) {
    return await this.usersService.create(dto);
  } 
  

  @Get()
  // @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Foydalanuvchilar ro\'yxati (Pagination & Search)' })
  @ApiQuery({ name: 'role', enum: UserRole, required: false })
  @ApiQuery({ name: 'search', required: false })
  async findAll(
    @Query('role') role?: UserRole,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return await this.usersService.findAll(role, search, Number(page) || 1, Number(limit) || 10);
  }

  @Get(':id')
  // @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'ID bo\'yicha olish' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.usersService.findOne(id);
  }

  @Patch(':id') // PUT o'rniga PATCH ishlatamiz
  // @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Foydalanuvchini qisman tahrirlash' })
  async update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() dto: UpdateUserDto
  ) {
    return await this.usersService.update(id, dto);
  }

  @Delete(':id')
  // @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Foydalanuvchini soft-delete qilish' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.remove(id);
    return { success: true, message: 'Foydalanuvchi arxivlandi (soft-deleted)' };
  }

  @Post(':id/restore')
  // @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'O\'chirilgan foydalanuvchini tiklash' })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return await this.usersService.restore(id);
  }
}