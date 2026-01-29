import { Controller, Get, Post, Param, Body, UseGuards, ParseUUIDPipe, Query, Delete, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles } from 'src/common/guards/roles.decarator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from 'src/entities/user.entity';
import { PaySalaryDto } from './dto/finance.dto';


// @ApiTags('Moliya va Oyliklar (Finance)')
// @ApiBearerAuth()
// @UseGuards(JwtAuthGuard,RolesGuard)
// @Controller('finance')
// export class FinanceController {
//   constructor(private readonly financeService: FinanceService) {}

//   @Get('teacher-salary/:teacherId')
// @Roles(UserRole.ADMIN, UserRole.TEACHER) // String o'rniga Enum ishlatganingiz xavfsizroq
//   @ApiOperation({ summary: 'O\'qituvchining joriy oylik maoshini hisoblab ko\'rish' })
//   @ApiParam({ name: 'teacherId', description: 'O\'qituvchining UUID-si' })
//   async getSalary(@Param('teacherId', ParseUUIDPipe) teacherId: string) {
//     return await this.financeService.getTeacherSalary(teacherId);
//   }

//   @Post('pay-salary')
//   @Roles('admin')
//   @ApiOperation({ summary: 'O\'qituvchiga oylik berish va bazaga yozish' })
//   @ApiResponse({ status: 201, description: 'Oylik muvaffaqiyatli to\'landi.' })
//   async paySalary(
//     @Body('teacherId', ParseUUIDPipe) teacherId: string,
//     @Body('month') month: string, // Format: "2026-01"
//   ) {
//     return await this.financeService.payTeacherSalary(teacherId, month);
//   }

//   @Get('payout-history')
//   @Roles('admin','teacher')
//   @ApiOperation({ summary: 'Barcha berilgan oyliklar tarixi' })
//   @ApiQuery({ name: 'teacherId', required: false })
//   async getHistory(@Query('teacherId') teacherId?: string) {
//     return await this.financeService.getPayoutHistory(teacherId);
//   }
// }

@ApiTags('Oyliklar (Salary)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('salary')
export class FinanceController {
  constructor(private readonly salaryService: FinanceService) {}

  @Get('calculate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'O\'qituvchi oyligini hisoblash (Guruhlar kesimida)' })
  async calculate(
    @Query('teacherId') teacherId: string,
    @Query('month') month: string, // format: 2026-01
  ) {
    return this.salaryService.calculateTeacherSalary(teacherId, month);
  }

  @Post('pay')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Hisoblangan oylikni bazaga saqlash' })
  async pay(@Body() dto: PaySalaryDto) {
    return this.salaryService.paySalary(dto);
  }

  @Get('all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Barcha to\'langan oyliklar ro\'yxati' })
  @ApiQuery({ name: 'month', required: false, example: '2026-01' })
  async findAll(@Query('month') month?: string) {
    return this.salaryService.findAll(month);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Bitta oylik to\'lovi tafsilotlari' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.salaryService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'To\'lov miqdorini tahrirlash' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('amount') amount: number
  ) {
    return this.salaryService.update(id, amount);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'To\'lovni o\'chirish (Bekor qilish)' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.salaryService.remove(id);
  }
}