// salary.controller.ts
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
  ApiResponse,
} from '@nestjs/swagger';
import { SalaryService } from './salary.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/guards/roles.decarator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../entities/user.entity';
import { PaySalaryDto, UpdateSalaryDto } from './salary.dto';

@ApiTags('Oyliklar (Salary)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('salary')
export class SalaryController {
  constructor(private readonly salaryService: SalaryService) {}

  @Get('estimated-all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Barcha o'qituvchilarning hisoblanayotgan oyliklari",
    description:
      "Bazaga yozmaydi. Davomat asosida har bir o'qituvchi uchun oylikni hisoblaydi.",
  })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-03-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2026-03-31' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: [
          {
            teacherId: 'uuid',
            fullName: 'Jasur Toshmatov',
            totalSalary: 2400000,
            groups: [{ name: 'Node.js', salary: 1200000 }],
          },
        ],
        statusCode: 200,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  async getAllEstimated(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.salaryService.getEstimatedSalaries(startDate, endDate);
  }

  @Get('calculate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "O'qituvchi oyligini guruhlar kesimida hisoblash" })
  @ApiQuery({ name: 'teacherId', required: true, example: 'teacher-uuid' })
  @ApiQuery({ name: 'startDate', required: true, example: '2026-03-01' })
  @ApiQuery({ name: 'endDate', required: true, example: '2026-03-31' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: {
          teacherId: 'uuid',
          fullName: 'Jasur Toshmatov',
          totalSalary: 2400000,
          groups: [
            {
              groupId: 'uuid',
              name: 'Node.js',
              lessonsCount: 12,
              salary: 1200000,
            },
          ],
        },
        statusCode: 200,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
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

  @Post('pay')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Hisoblangan oylikni bazaga saqlash (to'lash)" })
  @ApiResponse({
    status: 201,
    schema: {
      example: {
        data: {
          id: 'salary-uuid',
          teacherId: 'uuid',
          amount: 2400000,
          month: '2026-03',
          paidAt: '2026-03-13T10:00:00.000Z',
        },
        statusCode: 201,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  @ApiResponse({ status: 404, description: "O'qituvchi topilmadi" })
  async pay(@Body() dto: PaySalaryDto) {
    return this.salaryService.paySalary(dto);
  }

  @Get('all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Barcha to'langan oyliklar ro'yxati" })
  @ApiQuery({
    name: 'month',
    required: false,
    example: '2026-03',
    description: 'YYYY-MM format',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: [
          {
            id: 'uuid',
            amount: 2400000,
            month: '2026-03',
            teacher: { fullName: 'Jasur Toshmatov' },
          },
        ],
        statusCode: 200,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  async findAll(@Query('month') month?: string) {
    return this.salaryService.findAll(month);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Bitta oylik to'lovi tafsilotlari" })
  @ApiResponse({ status: 200, description: "To'lov ma'lumotlari" })
  @ApiResponse({ status: 404, description: "To'lov topilmadi" })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.salaryService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "To'lov miqdorini tahrirlash" })
  @ApiResponse({ status: 200, description: "To'lov muvaffaqiyatli yangilandi" })
  @ApiResponse({ status: 404, description: "To'lov topilmadi" })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSalaryDto,
  ) {
    return this.salaryService.update(id, dto.amount);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "To'lovni o'chirish (bekor qilish)" })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: { message: "To'lov bekor qilindi" },
        statusCode: 200,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  @ApiResponse({ status: 404, description: "To'lov topilmadi" })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.salaryService.remove(id);
  }
}
