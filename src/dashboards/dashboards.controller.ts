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
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { DashboardService } from './dashboards.service';
import { Roles } from 'src/common/guards/roles.decarator';
import { UserRole } from 'src/entities/user.entity';

@ApiTags('Dashboard') // Swagger uchun kategoriya
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard) // Himoya: faqat login qilganlar
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles(UserRole.ADMIN) // Faqat ma'lum rollar ko'ra oladi
  @ApiOperation({ summary: 'Markaziy dashboard statistikasi',description:"Berilgan sana oraligʻida markaziy dashboard uchun jami daromad, qarzdorlik, faol talabalar soni, yangi talabalar soni, davomat foizi va faol guruhlar sonini taqdim etadi. Keshga saqlangan maʼlumotlar 15 daqiqa davomida yangilanmaydi." })
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
    // Sanalarni default qilish (agar kelmasa oxirgi 30 kun)
    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();

    // Sanalar haqiqiyligini tekshirish
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException(
        'Sana formati notoʻgʻri (YYYY-MM-DD kutilmoqda)',
      );
    }

    return this.dashboardService.getSummary(start, end);
  }
}
