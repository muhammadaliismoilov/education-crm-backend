import { Controller, Get, Query, Res, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import * as express from 'express'
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/guards/roles.decarator';
import { UserRole } from 'src/entities/user.entity';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard) 
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('finance')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Moliyaviy tahlil hisoboti' })
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
  @Roles(UserRole.ADMIN,)
  @ApiOperation({ summary: "Qarzdorlar ro'yxatini Excel formatda yuklab olish" })
  @ApiResponse({ status: 200, description: 'Excel fayli yuklab olinadi' })
  async exportDebtors(@Res() res: express.Response) {
    return this.reportsService.exportDebtorsToExcel(res);
  }

  @Get('growth')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Talabalar oʻsish dinamikasi' })
  async getGrowth(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const { start, end } = this.validateDates(startDate, endDate);
    return this.reportsService.getGrowthReport(start, end);
  }

  @Get('teachers-performance')
  @Roles(UserRole.ADMIN, 'MANAGER')
  @ApiOperation({ summary: "O'qituvchilar dars berish samaradorligi" })
  async getTeacherPerformance() {
    return this.reportsService.getTeacherPerformance();
  }

  @Get('group-analytics')
  @Roles(UserRole.ADMIN, 'MANAGER')
  @ApiOperation({ summary: 'Guruhlar boʻyicha toʻliq tahlil' })
  async getGroupAnalytics() {
    return this.reportsService.getGroupAnalytics();
  }

  /**
   * Sanalarni tekshirish va default qiymat berish uchun yordamchi funksiya
   */
  private validateDates(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException("Sana formati noto'g'ri (YYYY-MM-DD kutilmoqda)");
    }

    return { start, end };
  }
}