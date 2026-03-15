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
  ApiParam,
} from '@nestjs/swagger';
import { SalaryService } from './salary.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/guards/roles.decarator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../entities/user.entity';
import { PaySalaryDto, UpdateSalaryDto } from './salary.dto';

// ─── Reusable examples ───────────────────────────────────────────────────────

const PAYOUT_EXAMPLE = {
  id: 'pay-uuid-1234',
  amount: 2400000,
  forMonth: '2026-03',
  teacher: {
    id: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
    fullName: 'Jasur Toshmatov',
    role: 'teacher',
    phone: '+998901234567',
  },
  createdAt: '2026-03-13T10:00:00.000Z',
  updatedAt: '2026-03-13T10:00:00.000Z',
};

const WRAP = (data: any, statusCode = 200) => ({
  data,
  statusCode,
  timestamp: '2026-03-13 10:00:00',
});

const NOT_FOUND = (msg = "Oylik to'lovi topilmadi") => ({
  statusCode: 404,
  message: msg,
  error: 'Not Found',
});

// ─────────────────────────────────────────────────────────────────────────────

@ApiTags('Oyliklar (Salary)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('salary')
export class SalaryController {
  constructor(private readonly salaryService: SalaryService) {}

  // ─────────────────────────────────────────────
  // GET /salary/estimated-all
  // ─────────────────────────────────────────────
  @Get('estimated-all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Barcha o'qituvchilarning hisoblanayotgan oyliklari",
    description:
      "Bazaga yozmaydi. Davomat asosida har bir o'qituvchi uchun oylik " +
      "hisoblanadi. Faqat hisoblangan oylik > 0 bo'lgan o'qituvchilar ko'rsatiladi.",
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    example: '2026-03-01',
    description: 'Boshlanish sanasi (YYYY-MM-DD). Default: joriy oyning 1-kuni',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    example: '2026-03-31',
    description:
      'Tugash sanasi (YYYY-MM-DD). Default: joriy oyning oxirgi kuni',
  })
  @ApiResponse({
    status: 200,
    description: "Barcha o'qituvchilar hisoblanayotgan oyliklari",
    schema: {
      example: WRAP({
        // TUZATISH: service { timestamp, startDate, endDate, teachersCount, data } qaytaradi
        timestamp: '2026-03-13T10:00:00.000Z',
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        teachersCount: 2,
        data: [
          {
            teacherId: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
            teacherName: 'Jasur Toshmatov',
            calculatedSalary: 2400000,
            startDate: '2026-03-01',
            endDate: '2026-03-31',
            details: [
              {
                groupName: 'Node.js Backend',
                groupDays: [1, 3, 5],
                totalLessonsInMonth: 12,
                perLessonRate: 66667,
                attendanceCount: 36,
                teacherEarned: 720000,
              },
            ],
          },
        ],
      }),
    },
  })
  async getAllEstimated(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.salaryService.getEstimatedSalaries(startDate, endDate);
  }

  // ─────────────────────────────────────────────
  // GET /salary/calculate
  // ─────────────────────────────────────────────
  @Get('calculate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "O'qituvchi oyligini guruhlar kesimida hisoblash",
    description:
      "Bitta o'qituvchi uchun davomat asosida oylikni hisoblaydi. " +
      'Bazaga yozmaydi — faqat hisoblash.',
  })
  @ApiQuery({
    name: 'teacherId',
    required: true,
    example: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
    description: "O'qituvchi UUID si",
  })
  @ApiQuery({
    name: 'startDate',
    required: true,
    example: '2026-03-01',
    description: 'Boshlanish sanasi (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    example: '2026-03-31',
    description: 'Tugash sanasi (YYYY-MM-DD)',
  })
  @ApiResponse({
    status: 200,
    description: "O'qituvchi oyligi hisoblandi",
    schema: {
      example: WRAP({
        // TUZATISH: service { teacherName, startDate, endDate, totalSalary, details } qaytaradi
        teacherName: 'Jasur Toshmatov',
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        totalSalary: 2400000,
        details: [
          {
            groupName: 'Node.js Backend',
            groupDays: [1, 3, 5],
            totalLessonsInMonth: 12,
            perLessonRate: 66667,
            attendanceCount: 36,
            teacherEarned: 720000,
          },
          {
            groupName: 'Python',
            groupDays: [2, 4],
            totalLessonsInMonth: 8,
            perLessonRate: 100000,
            attendanceCount: 24,
            teacherEarned: 720000,
          },
        ],
      }),
    },
  })
  @ApiResponse({
    status: 404,
    description: "O'qituvchi topilmadi",
    schema: { example: NOT_FOUND("O'qituvchi topilmadi") },
  })
  @ApiResponse({
    status: 400,
    description: "O'qituvchi foizi belgilanmagan",
    schema: {
      example: {
        statusCode: 400,
        message: "O'qituvchi foizi belgilanmagan",
        error: 'Bad Request',
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

  // ─────────────────────────────────────────────
  // POST /salary/pay
  // ─────────────────────────────────────────────
  @Post('pay')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Hisoblangan oylikni bazaga saqlash (to'lash)",
    description:
      "Oylikni bazaga yozadi. Bir oy uchun bir marta to'lanishi mumkin. " +
      "Takror to'lashda 400 xatosi qaytariladi.",
  })
  @ApiResponse({
    status: 201,
    description: "Oylik muvaffaqiyatli to'landi",
    schema: {
      example: WRAP(
        {
          // TUZATISH: service { message, payout } qaytaradi
          message: 'Oylik muvaffaqiyatli saqlandi',
          payout: PAYOUT_EXAMPLE,
        },
        201,
      ),
    },
  })
  @ApiResponse({
    status: 400,
    description: "Bu oy uchun oylik allaqachon to'langan",
    schema: {
      example: {
        statusCode: 400,
        message: "Bu oy uchun oylik allaqachon to'langan",
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "O'qituvchi topilmadi",
    schema: { example: NOT_FOUND("O'qituvchi topilmadi") },
  })
  async pay(@Body() dto: PaySalaryDto) {
    return this.salaryService.paySalary(dto);
  }

  // ─────────────────────────────────────────────
  // GET /salary/all
  // ─────────────────────────────────────────────
  @Get('all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Barcha to'langan oyliklar ro'yxati",
    description:
      "Oy bo'yicha filter qilish mumkin. Eng yangi to'lovlar birinchi.",
  })
  @ApiQuery({
    name: 'month',
    required: false,
    example: '2026-03',
    description: "Oy bo'yicha filter (YYYY-MM)",
  })
  @ApiResponse({
    status: 200,
    description: "To'langan oyliklar ro'yxati",
    schema: {
      example: WRAP(
        // TUZATISH: service SalaryPayout[] array qaytaradi — { data, meta } emas!
        [PAYOUT_EXAMPLE],
      ),
    },
  })
  async findAll(@Query('month') month?: string) {
    return this.salaryService.findAll(month);
  }

  // ─────────────────────────────────────────────
  // GET /salary/:id
  // ─────────────────────────────────────────────
  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Bitta oylik to'lovi tafsilotlari",
    description: 'teacher relation bilan birga qaytariladi.',
  })
  @ApiParam({ name: 'id', description: "To'lov UUID si", format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: "To'lov ma'lumotlari",
    schema: { example: WRAP(PAYOUT_EXAMPLE) },
  })
  @ApiResponse({
    status: 404,
    description: "To'lov topilmadi",
    schema: { example: NOT_FOUND() },
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.salaryService.findOne(id);
  }

  // ─────────────────────────────────────────────
  // PATCH /salary/:id
  // ─────────────────────────────────────────────
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "To'lov miqdorini tahrirlash",
    description: "Faqat amount o'zgaradi. Teacher va oy o'zgarmaydi.",
  })
  @ApiParam({ name: 'id', description: "To'lov UUID si", format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: "To'lov muvaffaqiyatli yangilandi",
    schema: {
      example: WRAP({
        // TUZATISH: service SalaryPayout entity qaytaradi (save dan)
        ...PAYOUT_EXAMPLE,
        amount: 1500000,
        updatedAt: '2026-03-13T11:00:00.000Z',
      }),
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validatsiya xatosi',
    schema: {
      example: {
        statusCode: 400,
        message: ["To'lov miqdori 0 dan katta bo'lishi kerak"],
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "To'lov topilmadi",
    schema: { example: NOT_FOUND() },
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSalaryDto,
  ) {
    return this.salaryService.update(id, dto.amount);
  }

  // ─────────────────────────────────────────────
  // DELETE /salary/:id
  // ─────────────────────────────────────────────
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "To'lovni o'chirish (bekor qilish)",
    description: "To'lov bazadan butunlay o'chiriladi (hard delete).",
  })
  @ApiParam({ name: 'id', description: "To'lov UUID si", format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: "To'lov muvaffaqiyatli o'chirildi",
    schema: {
      example: WRAP(
        // TUZATISH: service payoutRepo.remove(payout) qaytaradi —
        // o'chirilgan entity ning o'zini qaytaradi (id yo'q bo'ladi)
        {
          amount: 2400000,
          forMonth: '2026-03',
          teacher: { id: 'uuid', fullName: 'Jasur Toshmatov' },
          createdAt: '2026-03-13T10:00:00.000Z',
          updatedAt: '2026-03-13T10:00:00.000Z',
        },
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: "To'lov topilmadi",
    schema: { example: NOT_FOUND() },
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.salaryService.remove(id);
  }
}
