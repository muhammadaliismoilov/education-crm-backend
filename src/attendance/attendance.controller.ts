import { Controller, Post, Body, Get, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { MarkAttendanceDto } from './mark-attendance.dto';


@ApiTags('Davomat (Attendance)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Post('bulk')
  @ApiOperation({ summary: 'Guruh uchun ommaviy davomat qilish' })
  createBulk(@Body() dto: MarkAttendanceDto) {
    return this.service.markAttendance(dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Guruhning ma\'lum kungi davomatini olish' })
  getHistory(
    @Query('groupId', ParseUUIDPipe) groupId: string,
    @Query('date') date: string,
  ) {
    return this.service.getByGroupAndDate(groupId, date);
  }
}