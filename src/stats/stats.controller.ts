import { Controller, Get, Query } from '@nestjs/common';
import { StatsService } from './stats.service';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

@Get('yearly-chart')
@ApiOperation({ summary: 'Grafik uchun 1 yillik statistika' })
@ApiQuery({ name: 'year', example: 2026 })
@ApiQuery({ name: 'page', description: 'Oylar oralig\'i (masalan 1-bet 4 ta oy)', example: 1 })
async getYearlyChart(
  @Query('year') year: number = 2026,
  @Query('page') page: number = 1,
  @Query('limit') limit: number = 4 // Dizaynda 4 ta oy ko'rinib turibdi
) {
  const allStats = await this.statsService.getYearlyStats(+year);
  
  // Pagination mantiqi: 12 oyni limitga qarab bo'laklaymiz
  const startIndex = (page - 1) * limit;
  const paginatedStats = allStats.slice(startIndex, startIndex + limit);

  return {
    data: paginatedStats,
    totalMonths: 12,
    currentPage: +page,
    totalPages: Math.ceil(12 / limit)
  };
}





}
