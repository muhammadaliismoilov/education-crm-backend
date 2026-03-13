// reports.controller.ts
import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import * as express from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/guards/roles.decarator';
import { UserRole } from '../entities/user.entity';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('finance')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Moliyaviy tahlil hisoboti',
    description:
      "Berilgan sana oralig'ida olingan to'lovlar va qarzdorlar haqida umumiy ma'lumot.",
  })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2026-03-13' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: {
          totalIncome: 25000000,
          totalDebtors: 8,
          totalDebt: 4800000,
          payments: [
            {
              id: 'uuid',
              amount: 800000,
              student: { fullName: 'Alisher Karimov' },
              createdAt: '2026-03-01T10:00:00.000Z',
            },
          ],
        },
        statusCode: 200,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  @ApiResponse({ status: 400, description: "Sana formati noto'g'ri" })
  async getFinance(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const { start, end } = this.validateDates(startDate, endDate);
    return this.reportsService.getFinancialOverview(start, end);
  }

  @Get('export/debtors')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Qarzdorlar ro'yxatini Excel formatda yuklab olish",
  })
  @ApiResponse({
    status: 200,
    description: 'Excel fayli (.xlsx) yuklab olinadi',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {},
    },
  })
  async exportDebtors(@Res() res: express.Response) {
    return this.reportsService.exportDebtorsToExcel(res);
  }

  @Get('teachers-performance')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "O'qituvchilar samaradorligi hisoboti",
    description:
      "O'qituvchilarning dars berish samaradorligini baholash: talabalar soni, davomat foizi va hisoblangan oylik.",
  })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2026-03-13' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: [
          {
            teacherId: 'uuid',
            fullName: 'Jasur Toshmatov',
            groupsCount: 3,
            totalStudents: 35,
            attendancePercent: 82,
            estimatedSalary: 2400000,
          },
        ],
        statusCode: 200,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  @ApiResponse({ status: 400, description: "Sana formati noto'g'ri" })
  async getTeacherPerformance(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const { start, end } = this.validateDates(startDate, endDate);
    return this.reportsService.getTeacherPerformance(start, end);
  }

  private validateDates(startDate?: string, endDate?: string) {
    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    if (isNaN(start.getTime()) || isNaN(end.getTime()))
      throw new BadRequestException(
        "Sana formati noto'g'ri (YYYY-MM-DD kutilmoqda)",
      );
    if (start > end)
      throw new BadRequestException(
        "startDate endDate dan katta bo'lishi mumkin emas",
      );
    return { start, end };
  }
}
