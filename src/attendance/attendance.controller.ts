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
} from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../entities/user.entity';
import { Roles } from 'src/common/guards/roles.decarator';
import { MarkAttendanceDto } from './mark-attendance.dto';
import { UpdateSingleAttendanceDto } from './update-single-attendance.dto';

@ApiTags('Davomat (Attendance)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('sheet')
  @ApiOperation({ summary: 'Guruh talabalari ro‘yxatini davomat uchun olish' })
  @ApiQuery({ name: 'groupId', type: 'string' })
  @ApiQuery({ name: 'date', example: '2026-02-14' })
  async getSheet(
    @Query('groupId', ParseUUIDPipe) groupId: string,
    @Query('date') date: string,
  ) {
    return this.attendanceService.getAttendanceSheet(groupId, date);
  }

  @Post('bulk')
  @Roles(UserRole.ADMIN, UserRole.TEACHER) // ✅ Admin va Teacher qila oladi
  @ApiOperation({ summary: 'Davomatni ommaviy saqlash yoki yangilash' })
  async markBulk(@Body() dto: MarkAttendanceDto, @Request() req) {
    // ✅ Service'ga req.user.role uzatiladi
    return this.attendanceService.markBulk(dto, req.user.role);
  }

  @Patch('single-update')
  @Roles(UserRole.ADMIN, UserRole.TEACHER) // ✅ Admin va Teacher qila oladi
  @ApiOperation({ summary: 'Bitta talabaning davomatini tahrirlash' })
  async updateSingle(@Body() dto: UpdateSingleAttendanceDto, @Request() req) {
    // ✅ Service'ga req.user.role uzatiladi
    return this.attendanceService.updateSingleAttendance(dto, req.user.role);
  }

  @Get('monthly-report')
  @Roles(UserRole.ADMIN,UserRole.TEACHER) // ✅ Faqat Admin ko'ra oladi
  @ApiOperation({
    summary: 'Guruhning oylik pivot davomat hisoboti',
    description:
      'Berilgan guruh va oy uchun har bir talabaning har bir dars kunida "keldi" yoki "kelmadi" holatini ko‘rsatadigan pivot jadval shaklidagi hisobot.',
  })
  @ApiQuery({ name: 'groupId', type: 'string', required: true })
  @ApiQuery({
    name: 'month',
    example: '2026-02',
    required: false,
    description: 'Sana berilmasa, joriy oy olinadi',
  })
  async getMonthlyReport(
    @Query('groupId', ParseUUIDPipe) groupId: string,
    @Query('month') month?: string,
  ) {
    return this.attendanceService.getGroupMonthlyAttendance(groupId, month);
  }
}