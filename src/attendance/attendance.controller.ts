import { Controller, Post, Body, Get, Query, UseGuards, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
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
  // @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Guruh talabalari ro‘yxatini davomat uchun olish' })
  @ApiQuery({ name: 'groupId', type: 'string' })
  @ApiQuery({ name: 'date', example: '2026-01-25' })
  async getSheet(
    @Query('groupId', ParseUUIDPipe) groupId: string,
    @Query('date') date: string,
  ) {
    return this.attendanceService.getAttendanceSheet(groupId, date);
  }

  @Post('bulk')
  // @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Davomatni ommaviy saqlash yoki yangilash' })
  async markBulk(@Body() dto: MarkAttendanceDto) {
    return this.attendanceService.markBulk(dto);
  }

  @Patch('single-update')
  // @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Bitta talabaning davomatini tahrirlash (Kechikkanlar uchun)' })
  async updateSingle(@Body() dto: UpdateSingleAttendanceDto) {
    return this.attendanceService.updateSingleAttendance(dto);
  }
}