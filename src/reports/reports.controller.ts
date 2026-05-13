import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  BadRequestException,
  Req,
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

  @Get('finance/yearly')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Yillik moliyaviy tahlil hisoboti',
    description:
      'Berilgan yil uchun yillik summary va har oylik ' +
      'daromad, qarzdorlik, oqituvchilar oyligi va sof foyda hisoblanadi. ' +
      'Natija 3 daqiqa keshlanadi.',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    example: '2026',
    description: 'Yil (YYYY). Default: joriy yil',
  })
  @ApiResponse({
    status: 200,
    description: 'Yillik moliyaviy hisobot muvaffaqiyatli qaytarildi',
    schema: {
      example: WRAP({
        summary: {
          totalIncome: 3300000,
          totalPending: 300000,
          totalTeacherSalaries: 185808,
          totalExpenses: 50000,
          netProfit: 3064192,
          currency: "so'm",
          generatedAt: '2026-03-16T10:00:00.000Z',
          period: {
            from: '2026-01-01T00:00:00.000Z',
            to: '2026-12-31T23:59:59.999Z',
          },
        },
        monthlyData: [
          {
            month: 1,
            monthName: 'Yanvar',
            totalIncome: 0,
            totalPending: 0,
            totalTeacherSalaries: 0,
            netProfit: 0,
          },
          {
            month: 2,
            monthName: 'Fevral',
            totalIncome: 800000,
            totalPending: 0,
            totalTeacherSalaries: 92904,
            totalExpenses: 20000,
            netProfit: 687096,
          },
          {
            month: 3,
            monthName: 'Mart',
            totalIncome: 2500000,
            totalPending: 300000,
            totalTeacherSalaries: 92904,
            totalExpenses: 30000,
            netProfit: 2377096,
          },
          {
            month: 4,
            monthName: 'Aprel',
            totalIncome: 0,
            totalPending: 0,
            totalTeacherSalaries: 0,
            netProfit: 0,
          },
          {
            month: 5,
            monthName: 'May',
            totalIncome: 0,
            totalPending: 0,
            totalTeacherSalaries: 0,
            netProfit: 0,
          },
          {
            month: 6,
            monthName: 'Iyun',
            totalIncome: 0,
            totalPending: 0,
            totalTeacherSalaries: 0,
            netProfit: 0,
          },
          {
            month: 7,
            monthName: 'Iyul',
            totalIncome: 0,
            totalPending: 0,
            totalTeacherSalaries: 0,
            netProfit: 0,
          },
          {
            month: 8,
            monthName: 'Avgust',
            totalIncome: 0,
            totalPending: 0,
            totalTeacherSalaries: 0,
            netProfit: 0,
          },
          {
            month: 9,
            monthName: 'Sentyabr',
            totalIncome: 0,
            totalPending: 0,
            totalTeacherSalaries: 0,
            netProfit: 0,
          },
          {
            month: 10,
            monthName: 'Oktyabr',
            totalIncome: 0,
            totalPending: 0,
            totalTeacherSalaries: 0,
            netProfit: 0,
          },
          {
            month: 11,
            monthName: 'Noyabr',
            totalIncome: 0,
            totalPending: 0,
            totalTeacherSalaries: 0,
            netProfit: 0,
          },
          {
            month: 12,
            monthName: 'Dekabr',
            totalIncome: 0,
            totalPending: 0,
            totalTeacherSalaries: 0,
            netProfit: 0,
          },
        ],
      }),
    },
  })
  @ApiResponse({
    status: 400,
    description: "Yil formati noto'g'ri",
    schema: {
      example: {
        success: false,
        message: "Yil formati noto'g'ri. To'g'ri format: YYYY (masalan: 2026)",
      },
    },
  })
  async getYearlyFinance(@Query('year') yearStr?: string, @Req() req?: any) {
    const currentYear = new Date().getFullYear();
    const year = yearStr ? parseInt(yearStr, 10) : currentYear;

    if (isNaN(year) || year < 2000 || year > currentYear + 1) {
      throw new BadRequestException(
        "Yil formati noto'g'ri. To'g'ri format: YYYY (masalan: 2026)",
      );
    }

    return this.reportsService.getYearlyFinancialOverview(year, req?.user);
  }
  // ─────────────────────────────────────────────
  // GET /reports/finance
  // ─────────────────────────────────────────────
  @Get('finance')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.MANAGER)
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
        totalIncome: 25000000,
        totalPending: 4800000,
        totalTeacherSalaries: 7200000,
        totalExpenses: 1500000,
        netProfit: 16300000,
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
    @Req() req?: any,
  ) {
    const { start, end } = this.validateDates(startDate, endDate);
    return this.reportsService.getFinancialOverview(start, end, req?.user);
  }

  // ─────────────────────────────────────────────
  // GET /reports/export/debtors
  // ─────────────────────────────────────────────
  @Get('export/debtors')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.MANAGER)
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
  async exportDebtors(@Res() res: express.Response, @Req() req?: any) {
    return this.reportsService.exportDebtorsToExcel(res, req?.user);
  }

  // ─────────────────────────────────────────────
  // GET /reports/teachers-performance
  // ─────────────────────────────────────────────
  @Get('teachers-performance')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.MANAGER)
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
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({
    status: 200,
    description: "O'qituvchilar samaradorligi muvaffaqiyatli qaytarildi",
    schema: {
      example: WRAP({
        data: [
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
        ],
        meta: {
          totalItems: 3,
          totalPages: 1,
          currentPage: 1,
          itemsPerPage: 10,
        },
      }),
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
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Req() req?: any,
  ) {
    const { start, end } = this.validateDates(startDate, endDate);
    return this.reportsService.getTeacherPerformance(
      start,
      end,
      req?.user,
      page,
      limit,
    );
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
