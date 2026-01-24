import { Controller, Get, Post, Param, Body, UseGuards, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles } from 'src/common/guards/roles.decarator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from 'src/entities/user.entity';


@ApiTags('Moliya va Oyliklar (Finance)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard,RolesGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('teacher-salary/:teacherId')
@Roles(UserRole.ADMIN, UserRole.TEACHER) // String o'rniga Enum ishlatganingiz xavfsizroq
  @ApiOperation({ summary: 'O\'qituvchining joriy oylik maoshini hisoblab ko\'rish' })
  @ApiParam({ name: 'teacherId', description: 'O\'qituvchining UUID-si' })
  async getSalary(@Param('teacherId', ParseUUIDPipe) teacherId: string) {
    return await this.financeService.getTeacherSalary(teacherId);
  }

  @Post('pay-salary')
  @Roles('admin')
  @ApiOperation({ summary: 'O\'qituvchiga oylik berish va bazaga yozish' })
  @ApiResponse({ status: 201, description: 'Oylik muvaffaqiyatli to\'landi.' })
  async paySalary(
    @Body('teacherId', ParseUUIDPipe) teacherId: string,
    @Body('month') month: string, // Format: "2026-01"
  ) {
    return await this.financeService.payTeacherSalary(teacherId, month);
  }

  @Get('payout-history')
  @Roles('admin','teacher')
  @ApiOperation({ summary: 'Barcha berilgan oyliklar tarixi' })
  @ApiQuery({ name: 'teacherId', required: false })
  async getHistory(@Query('teacherId') teacherId?: string) {
    return await this.financeService.getPayoutHistory(teacherId);
  }
}