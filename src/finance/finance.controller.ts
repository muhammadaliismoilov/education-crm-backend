import { Controller, Get, Post, Param, Body, UseGuards, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';


@ApiTags('Moliya va Oyliklar (Finance)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('teacher-salary/:teacherId')
  @ApiOperation({ summary: 'O\'qituvchining joriy oylik maoshini hisoblab ko\'rish' })
  @ApiParam({ name: 'teacherId', description: 'O\'qituvchining UUID-si' })
  async getSalary(@Param('teacherId', ParseUUIDPipe) teacherId: string) {
    return await this.financeService.getTeacherSalary(teacherId);
  }

  @Post('pay-salary')
  @ApiOperation({ summary: 'O\'qituvchiga oylik berish va bazaga yozish' })
  @ApiResponse({ status: 201, description: 'Oylik muvaffaqiyatli to\'landi.' })
  async paySalary(
    @Body('teacherId', ParseUUIDPipe) teacherId: string,
    @Body('month') month: string, // Format: "2026-01"
  ) {
    return await this.financeService.payTeacherSalary(teacherId, month);
  }

  @Get('payout-history')
  @ApiOperation({ summary: 'Barcha berilgan oyliklar tarixi' })
  @ApiQuery({ name: 'teacherId', required: false })
  async getHistory(@Query('teacherId') teacherId?: string) {
    return await this.financeService.getPayoutHistory(teacherId);
  }
}