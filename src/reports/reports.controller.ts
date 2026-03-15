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

// ─── Reusable examples ───────────────────────────────────────────────────────

const WRAP = (data: any, statusCode = 200) => ({
  data,
  statusCode,
  timestamp: '2026-03-13 10:00:00',
});

const DATE_ERROR = {
  statusCode: 400,
  message: "startDate endDate dan katta bo'lishi mumkin emas",
  error: 'Bad Request',
};

// ─────────────────────────────────────────────────────────────────────────────

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ─────────────────────────────────────────────
  // GET /reports/finance
  // ─────────────────────────────────────────────
  @Get('finance')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Moliyaviy tahlil hisoboti',
    description:
      "Berilgan sana oralig'ida jami daromad, qarzdorlik, o'qituvchilar " +
      'oyliklari va sof foyda hisoblanadi. Natija 3 daqiqa keshlanadi.',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    example: '2026-01-01',
    description: 'Boshlanish sanasi (YYYY-MM-DD). Default: 30 kun oldin',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    example: '2026-03-13',
    description: 'Tugash sanasi (YYYY-MM-DD). Default: bugun',
  })
  @ApiResponse({
    status: 200,
    description: 'Moliyaviy hisobot muvaffaqiyatli qaytarildi',
    schema: {
      example: WRAP({
        // TUZATISH: service { totalIncome, totalPending, totalTeacherSalaries,
        // netProfit, currency, generatedAt, period } qaytaradi
        totalIncome: 25000000,
        totalPending: 4800000,
        totalTeacherSalaries: 7200000,
        netProfit: 17800000,
        currency: "so'm",
        generatedAt: '2026-03-13T10:00:00.000Z',
        period: {
          from: '2026-01-01T00:00:00.000Z',
          to: '2026-03-13T23:59:59.999Z',
        },
      }),
    },
  })
  @ApiResponse({
    status: 400,
    description: "Sana formati noto'g'ri yoki start > end",
    schema: { example: DATE_ERROR },
  })
  async getFinance(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const { start, end } = this.validateDates(startDate, endDate);
    return this.reportsService.getFinancialOverview(start, end);
  }

  // ─────────────────────────────────────────────
  // GET /reports/export/debtors
  // ─────────────────────────────────────────────
  @Get('export/debtors')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Qarzdorlar ro'yxatini Excel formatda yuklab olish",
    description:
      'Barcha qarzdor talabalarni Excel (.xlsx) formatda yuklab beradi. ' +
      "Qarz 500,000 so'mdan ko'p bo'lsa qizil rang bilan belgilanadi.",
  })
  @ApiResponse({
    status: 200,
    description: 'Excel fayli (.xlsx) yuklab olinadi',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: {
          type: 'string',
          format: 'binary',
          description:
            'Fayl nomi: Qarzdorlar_DD-MM-YYYY.xlsx. ' +
            "Ustunlar: №, Talaba F.I.SH, Telefon, Guruh, Kurs Narxi, To'langan Summa, Qarz Miqdori",
        },
      },
    },
  })
  async exportDebtors(@Res() res: express.Response) {
    return this.reportsService.exportDebtorsToExcel(res);
  }

  // ─────────────────────────────────────────────
  // GET /reports/teachers-performance
  // ─────────────────────────────────────────────
  @Get('teachers-performance')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "O'qituvchilar samaradorligi hisoboti",
    description:
      "Har bir o'qituvchining har bir guruhi bo'yicha dars soni, talabalar soni " +
      "va davomat foizi ko'rsatiladi. Natija 3 daqiqa keshlanadi.",
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    example: '2026-01-01',
    description: 'Boshlanish sanasi (YYYY-MM-DD). Default: 30 kun oldin',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    example: '2026-03-13',
    description: 'Tugash sanasi (YYYY-MM-DD). Default: bugun',
  })
  @ApiResponse({
    status: 200,
    description: "O'qituvchilar samaradorligi muvaffaqiyatli qaytarildi",
    schema: {
      example: WRAP(
        // TUZATISH: service array qaytaradi — har bir yozuv bitta guruh uchun:
        // { teacherId, teacherName, groupName, totalLessons,
        //   totalStudents, shouldAttend, attendedCount, attendanceRate }
        [
          {
            teacherId: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
            teacherName: 'Jasur Toshmatov',
            groupName: 'Node.js Backend',
            totalLessons: 12,
            totalStudents: 15,
            shouldAttend: 180,
            attendedCount: 148,
            attendanceRate: 82,
          },
          {
            teacherId: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
            teacherName: 'Jasur Toshmatov',
            groupName: 'Python',
            totalLessons: 8,
            totalStudents: 12,
            shouldAttend: 96,
            attendedCount: 84,
            attendanceRate: 88,
          },
          {
            teacherId: 'a1b2c3d4-1234-5678-abcd-ef1234567890',
            teacherName: 'Nilufar Hasanova',
            groupName: 'English A1',
            totalLessons: 20,
            totalStudents: 10,
            shouldAttend: 200,
            attendedCount: 170,
            attendanceRate: 85,
          },
        ],
      ),
    },
  })
  @ApiResponse({
    status: 400,
    description: "Sana formati noto'g'ri yoki start > end",
    schema: { example: DATE_ERROR },
  })
  async getTeacherPerformance(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const { start, end } = this.validateDates(startDate, endDate);
    return this.reportsService.getTeacherPerformance(start, end);
  }

  // ─────────────────────────────────────────────
  // PRIVATE — sana validatsiyasi
  // ─────────────────────────────────────────────
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
