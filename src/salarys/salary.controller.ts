import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  Query,
  Delete,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { SalaryService } from './salary.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles } from 'src/common/guards/roles.decarator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from 'src/entities/user.entity';
import { PaySalaryDto } from './salary.dto';

@ApiTags('Oyliklar (Salary)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('salary')
export class SalaryController {
  constructor(private readonly salaryService: SalaryService) {}

  @Get('estimated-all')
  @ApiOperation({
    summary: 'Barcha o‘qituvchilarning real-vaqtdagi hisoblanayotgan oyliklari',
    description:
      'Bu API bazaga ma’lumot yozmaydi, faqat joriy davomat asosida hisoblab beradi.',
  })
  @ApiQuery({ name: 'month', required: false, example: '2026-02' })
  async getAllEstimated(@Query('month') month?: string) {
    return this.salaryService.getEstimatedSalaries(month);
  }

  @Get('calculate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "O'qituvchi oyligini hisoblash (Guruhlar kesimida)",
  })
  async calculate(
    @Query('teacherId') teacherId: string,
    @Query('month') month: string, // format: 2026-01
  ) {
    return this.salaryService.calculateTeacherSalary(teacherId, month);
  }

  @Post('pay')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Hisoblangan oylikni bazaga saqlash' })
  async pay(@Body() dto: PaySalaryDto) {
    return this.salaryService.paySalary(dto);
  }

  @Get('all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Barcha to'langan oyliklar ro'yxati" })
  @ApiQuery({ name: 'month', required: false, example: '2026-01' })
  async findAll(@Query('month') month?: string) {
    return this.salaryService.findAll(month);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Bitta oylik to'lovi tafsilotlari" })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.salaryService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "To'lov miqdorini tahrirlash" })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('amount') amount: number,
  ) {
    return this.salaryService.update(id, amount);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "To'lovni o'chirish (Bekor qilish)" })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.salaryService.remove(id);
  }
}
