import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Patch,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../entities/user.entity';
import { Roles } from '../common/guards/roles.decarator';
import { MarkAttendanceDto } from './mark-attendance.dto';
import { UpdateSingleAttendanceDto } from './update-single-attendance.dto';

@ApiTags('Davomat (Attendance)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // ─────────────────────────────────────────────
  // GET /attendance/sheet
  // ─────────────────────────────────────────────
  @Get('sheet')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: "Guruh talabalari ro'yxatini davomat uchun olish",
    description:
      "Berilgan guruh va sana uchun talabalar ro'yxatini qaytaradi. Har bir talaba uchun davomat holati (keldi/kelmadi), balans va to'lov holati ko'rsatiladi.",
  })
  @ApiQuery({
    name: 'groupId',
    type: 'string',
    required: true,
    description: 'Guruh UUID si',
    example: 'bb096922-6249-4911-9a8c-9a503bb3e7d9',
  })
  @ApiQuery({
    name: 'date',
    type: 'string',
    required: true,
    description: 'Davomat sanasi (YYYY-MM-DD)',
    example: '2026-03-13',
  })
  @ApiResponse({
    status: 200,
    description: "Guruh va talabalar ro'yxati muvaffaqiyatli qaytarildi",
    schema: {
      example: {
        data: {
          groupInfo: {
            id: 'bb096922-6249-4911-9a8c-9a503bb3e7d9',
            name: 'Node.js Backend',
            startTime: '14:00',
            endTime: '16:00',
            paidStudentsCount: 8,
            totalStudents: 10,
          },
          students: [
            {
              studentId: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
              fullName: 'Alisher Karimov',
              isPresent: true,
              balance: 500000,
              hasPaid: true,
            },
            {
              studentId: 'a1b2c3d4-1234-5678-abcd-ef1234567890',
              fullName: 'Zulfiya Rahimova',
              isPresent: false,
              balance: -200000,
              hasPaid: false,
            },
          ],
        },
        statusCode: 200,
        timestamp: '2026-03-13 14:05:00',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Dars vaqti emas — teacher uchun',
    schema: {
      example: {
        statusCode: 403,
        message: 'Davomat faqat dars vaqtida qilinishi mumkin: 14:00 - 16:00',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Guruh topilmadi' })
  async getSheet(
    @Query('groupId', ParseUUIDPipe) groupId: string,
    @Query('date') date: string,
    @Request() req,
  ) {
    return this.attendanceService.getAttendanceSheet(groupId, date, req.user.role);
  }

  // ─────────────────────────────────────────────
  // POST /attendance/bulk
  // ─────────────────────────────────────────────
  @Post('bulk')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Davomatni ommaviy saqlash yoki yangilash',
    description:
      "Guruhning barcha talabalari uchun bir vaqtda davomat belgilaydi. Agar shu kun uchun davomat allaqachon mavjud bo'lsa — qayta yoziladi.",
  })
  @ApiResponse({
    status: 201,
    description: 'Davomat muvaffaqiyatli saqlandi',
    schema: {
      example: {
        data: {
          success: true,
          message: 'Davomat saqlandi',
        },
        statusCode: 201,
        timestamp: '2026-03-13 14:10:00',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Sana formati noto'g'ri yoki boshqa validatsiya xatosi",
    schema: {
      example: {
        statusCode: 400,
        message: "Sana formati noto'g'ri. To'g'ri format: YYYY-MM-DD",
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Dars vaqti emas' })
  @ApiResponse({ status: 404, description: 'Guruh topilmadi' })
  async markBulk(@Body() dto: MarkAttendanceDto, @Request() req) {
    return this.attendanceService.markBulk(dto, req.user.role);
  }

  // ─────────────────────────────────────────────
  // PATCH /attendance/single-update
  // ─────────────────────────────────────────────
  @Patch('single-update')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Bitta talabaning davomatini tahrirlash',
    description:
      "Bitta talabaning ma'lum bir kundagi davomat holatini yangilaydi. Yozuv mavjud bo'lsa yangilanadi, yo'q bo'lsa yaratiladi.",
  })
  @ApiResponse({
    status: 200,
    description: 'Davomat muvaffaqiyatli yangilandi',
    schema: {
      example: {
        data: {
          id: 'c9d8e7f6-abcd-1234-ef56-789012345678',
          date: '2026-03-13',
          isPresent: false,
          student: { id: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8' },
          group: { id: 'bb096922-6249-4911-9a8c-9a503bb3e7d9' },
        },
        statusCode: 200,
        timestamp: '2026-03-13 14:15:00',
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Dars vaqti emas' })
  @ApiResponse({ status: 404, description: 'Guruh topilmadi' })
  async updateSingle(@Body() dto: UpdateSingleAttendanceDto, @Request() req) {
    return this.attendanceService.updateSingleAttendance(dto, req.user.role);
  }

  // ─────────────────────────────────────────────
  // GET /attendance/monthly-report
  // ─────────────────────────────────────────────
  @Get('monthly-report')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Guruhning oylik pivot davomat hisoboti',
    description:
      "Berilgan guruh va oy uchun har bir talabaning har bir dars kunida keldi (1) yoki kelmadi (0) holatini ko'rsatadigan pivot jadval. Davomat bo'lmagan kunlar null qaytariladi.",
  })
  @ApiQuery({
    name: 'groupId',
    type: 'string',
    required: true,
    description: 'Guruh UUID si',
    example: 'bb096922-6249-4911-9a8c-9a503bb3e7d9',
  })
  @ApiQuery({
    name: 'month',
    type: 'string',
    required: false,
    description: 'Oy (YYYY-MM). Berilmasa joriy oy olinadi',
    example: '2026-03',
  })
  @ApiResponse({
    status: 200,
    description: 'Oylik davomat hisoboti muvaffaqiyatli qaytarildi',
    schema: {
      example: {
        data: {
          groupInfo: {
            id: 'bb096922-6249-4911-9a8c-9a503bb3e7d9',
            name: 'Node.js Backend',
            totalStudents: 10,
          },
          month: '2026-03',
          columns: ['2026-03-03 14:00', '2026-03-05 14:00', '2026-03-10 14:00'],
          students: [
            {
              studentId: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
              fullName: 'Alisher Karimov',
              totalPresent: 2,
              attendance: {
                '2026-03-03 14:00': 1,
                '2026-03-05 14:00': 0,
                '2026-03-10 14:00': 1,
              },
            },
            {
              studentId: 'a1b2c3d4-1234-5678-abcd-ef1234567890',
              fullName: 'Zulfiya Rahimova',
              totalPresent: 1,
              attendance: {
                '2026-03-03 14:00': null,
                '2026-03-05 14:00': 1,
                '2026-03-10 14:00': 0,
              },
            },
          ],
        },
        statusCode: 200,
        timestamp: '2026-03-13 15:00:00',
      },
    },
  })
  @ApiResponse({ status: 400, description: "Month formati noto'g'ri" })
  @ApiResponse({ status: 404, description: 'Guruh topilmadi' })
  async getMonthlyReport(
    @Query('groupId', ParseUUIDPipe) groupId: string,
    @Query('month') month?: string,
  ) {
    return this.attendanceService.getGroupMonthlyAttendance(groupId, month);
  }

  // ─────────────────────────────────────────────
  // POST /attendance/face-verify
  // ─────────────────────────────────────────────
  @Post('face-verify')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Yuz orqali davomat belgilash',
    description:
      "Kameradan olingan base64 rasm orqali talabani tanib davomatini belgilaydi. Guruh talabalari ichida eng o'xshash yuz topiladi. O'xshashlik 55% dan past bo'lsa talaba tanilmaydi.",
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['groupId', 'date', 'base64'],
      properties: {
        groupId: {
          type: 'string',
          format: 'uuid',
          description: 'Guruh UUID si',
          example: 'bb096922-6249-4911-9a8c-9a503bb3e7d9',
        },
        date: {
          type: 'string',
          description: 'Davomat sanasi (YYYY-MM-DD)',
          example: '2026-03-13',
        },
        base64: {
          type: 'string',
          description: "Kameradan olingan rasm (data:image/jpeg;base64,... ko'rinishida)",
          example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgAB...',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Talaba tanildi va davomat belgilandi',
    schema: {
      example: {
        data: {
          success: true,
          message: 'Alisher Karimov davomatga belgilandi',
          studentId: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
          fullName: 'Alisher Karimov',
          similarity: 87,
          alreadyMarked: false,
        },
        statusCode: 201,
        timestamp: '2026-03-13 14:05:00',
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Talaba tanildi lekin davomat allaqachon belgilangan',
    schema: {
      example: {
        data: {
          success: true,
          message: 'Alisher Karimov davomat allaqachon belgilangan',
          studentId: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
          fullName: 'Alisher Karimov',
          similarity: 87,
          alreadyMarked: true,
        },
        statusCode: 201,
        timestamp: '2026-03-13 14:05:00',
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "Talaba tanilmadi (o'xshashlik 55% dan past)",
    schema: {
      example: {
        data: {
          success: false,
          message: 'Talaba tanilmadi',
          similarity: 32,
        },
        statusCode: 201,
        timestamp: '2026-03-13 14:05:00',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Rasm formati noto'g'ri yoki rasmda yuz topilmadi",
    schema: {
      example: {
        statusCode: 400,
        message: 'Rasmda yuz topilmadi! Aniqroq rasm yuboring.',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Dars vaqti emas' })
  @ApiResponse({ status: 404, description: 'Guruh topilmadi' })
  async faceVerify(
    @Body() body: { groupId: string; date: string; base64: string },
    @Request() req,
  ) {
    return this.attendanceService.faceVerifyAttendance(
      body.groupId,
      body.date,
      body.base64,
      req.user.role,
    );
  }
}