import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Patch,
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
  @ApiOperation({ summary: 'Davomatni ommaviy saqlash yoki yangilash' })
  async markBulk(@Body() dto: MarkAttendanceDto) {
    return this.attendanceService.markBulk(dto);
  }

  @Patch('single-update')
  @ApiOperation({ summary: 'Bitta talabaning davomatini tahrirlash' })
  async updateSingle(@Body() dto: UpdateSingleAttendanceDto) {
    return this.attendanceService.updateSingleAttendance(dto);
  }

  @Get('monthly-report')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Guruhning oylik pivot davomat hisoboti',
    description:
      'Berilgan guruh va oy uchun har bir talabaning har bir dars kunida "keldi" yoki "kelmadi" holatini ko‘rsatadigan pivot jadval shaklidagi hisobotni qaytaradi. Bu hisobot o‘qituvchilarning oylik maoshini hisoblashda foydalaniladi. ',
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
