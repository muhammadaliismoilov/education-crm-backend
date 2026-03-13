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
      "Berilgan sana oralig'ida markaziy dashboard uchun jami daromad, qarzdorlik, faol talabalar soni va boshqa ko'rsatkichlarni taqdim etadi.",
  })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2026-12-31' })
  @ApiResponse({
    status: 200,
    description: 'Statistika muvaffaqiyatli qaytarildi',
  })
  async getSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException(
        "Sana formati noto'g'ri (YYYY-MM-DD kutilmoqda)",
      );
    }

    // TUZATISH: start > end tekshiruvi yo'q edi
    if (start > end) {
      throw new BadRequestException(
        "startDate endDate dan katta bo'lishi mumkin emas",
      );
    }

    return this.dashboardService.getSummary(start, end);
  }
}
