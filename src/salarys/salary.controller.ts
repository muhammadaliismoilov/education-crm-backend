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
  ApiBearerAuth,
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

  // ─────────────────────────────────────────────
  // Barcha o'qituvchilar oyligi
  // ─────────────────────────────────────────────
  @Get('estimated-all')
  @ApiOperation({
    summary: 'Barcha o\'qituvchilarning hisoblanayotgan oyliklari',
    description: 'Bazaga yozmaydi, davomat asosida hisoblab beradi.',
  })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-02-01' })
  @ApiQuery({ name: 'endDate',   required: false, example: '2026-02-28' })
  async getAllEstimated(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.salaryService.getEstimatedSalaries(startDate, endDate);
  }

  // ─────────────────────────────────────────────
  // Bitta o'qituvchi oyligi
  // ─────────────────────────────────────────────
  @Get('calculate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'O\'qituvchi oyligini hisoblash (Guruhlar kesimida)',
  })
  @ApiQuery({ name: 'teacherId',  required: true,  example: 'uuid' })
  @ApiQuery({ name: 'startDate',  required: true,  example: '2026-02-01' })
  @ApiQuery({ name: 'endDate',    required: true,  example: '2026-02-28' })
  async calculate(
    @Query('teacherId') teacherId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.salaryService.calculateTeacherSalary(
      teacherId,
      startDate,
      endDate,
    );
  }

  // ─────────────────────────────────────────────
  // Oylik to'lash
  // ─────────────────────────────────────────────
  @Post('pay')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Hisoblangan oylikni bazaga saqlash' })
  async pay(@Body() dto: PaySalaryDto) {
    return this.salaryService.paySalary(dto);
  }

  // ─────────────────────────────────────────────
  // Barcha to'langan oyliklar
  // ─────────────────────────────────────────────
  @Get('all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Barcha to\'langan oyliklar ro\'yxati' })
  @ApiQuery({ name: 'month', required: false, example: '2026-01' })
  async findAll(@Query('month') month?: string) {
    return this.salaryService.findAll(month);
  }

  // ─────────────────────────────────────────────
  // Bitta to'lov
  // ─────────────────────────────────────────────
  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Bitta oylik to\'lovi tafsilotlari' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.salaryService.findOne(id);
  }

  // ─────────────────────────────────────────────
  // To'lovni yangilash
  // ─────────────────────────────────────────────
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'To\'lov miqdorini tahrirlash' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('amount') amount: number,
  ) {
    return this.salaryService.update(id, amount);
  }

  // ─────────────────────────────────────────────
  // To'lovni o'chirish
  // ─────────────────────────────────────────────
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'To\'lovni o\'chirish (Bekor qilish)' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.salaryService.remove(id);
  }
}