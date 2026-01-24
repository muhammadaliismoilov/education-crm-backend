import { Controller, Post, Body, Get, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { MarkAttendanceDto } from './mark-attendance.dto';


@ApiTags('Davomat (Attendance)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('sheet')
  @ApiOperation({ summary: 'Davomat olish uchun guruh talabalar ro\'yxatini olish' })
  @ApiQuery({ name: 'date', example: '2026-01-23' })
  getSheet(
    @Query('groupId', ParseUUIDPipe) groupId: string,
    @Query('date') date: string,
  ) {
    return this.attendanceService.getAttendanceSheet(groupId, date);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Davomatni ommaviy saqlash yoki yangilash' })
  markBulk(@Body() dto: MarkAttendanceDto) {
    return this.attendanceService.markBulk(dto);
  }
}