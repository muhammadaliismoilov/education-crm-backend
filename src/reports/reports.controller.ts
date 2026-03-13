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
      "Berilgan sana oralig'ida olingan to'lovlar va qarzdorlar haqida umumiy ma'lumot beradi.",
  })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2026-02-19' })
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
  @ApiResponse({ status: 200, description: 'Excel fayli yuklab olinadi' })
  async exportDebtors(@Res() res: express.Response) {
    return this.reportsService.exportDebtorsToExcel(res);
  }

  @Get('teachers-performance')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "O'qituvchilar dars berish samaradorligi",
    description:
      "O'qituvchilarning dars berish samaradorligini baholash uchun darslariga qatnashgan talabalar soni va boshqa ko'rsatkichlarni taqdim etadi.",
  })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2026-02-19' })
  async getTeacherPerformance(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const { start, end } = this.validateDates(startDate, endDate);
    return this.reportsService.getTeacherPerformance(start, end);
  }

  // TUZATISH: start > end tekshiruvi yo'q edi —
  // startDate=2026-12-01 endDate=2026-01-01 bo'lsa noto'g'ri natija qaytarardi
  private validateDates(startDate?: string, endDate?: string) {
    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException(
        "Sana formati noto'g'ri (YYYY-MM-DD kutilmoqda)",
      );
    }

    if (start > end) {
      throw new BadRequestException(
        "startDate endDate dan katta bo'lishi mumkin emas",
      );
    }

    return { start, end };
  }
}
