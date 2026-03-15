// dashboard.controller.ts
import {
  Controller,
  Get,
  Query,
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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { DashboardService } from './dashboards.service';
import { Roles } from '../common/guards/roles.decarator';
import { UserRole } from '../entities/user.entity';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Markaziy dashboard statistikasi',
    description:
      "Berilgan sana oralig'ida jami daromad, qarzdorlik, faol talabalar, " +
      'yangi talabalar, davomat foizi va faol guruhlar soni. ' +
      'Natija 10 daqiqa keshlanadi.',
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
    description: 'Statistika muvaffaqiyatli qaytarildi',
    schema: {
      example: {
        data: {
          totalIncome: 15000000,
          totalPending: 3200000,
          activeStudents: 87,
          newStudents: 12,
          attendancePercent: 78,
          activeGroups: 9,
          currency: "so'm",
          calculatedAt: '2026-03-13T10:00:00.000Z',
        },
        statusCode: 200,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Sana formati noto'g'ri yoki start > end",
    schema: {
      example: {
        statusCode: 400,
        message: "startDate endDate dan katta bo'lishi mumkin emas",
        error: 'Bad Request',
      },
    },
  })
  async getSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
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

    return this.dashboardService.getSummary(start, end);
  }
}
