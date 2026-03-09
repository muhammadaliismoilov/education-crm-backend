// import {
//   Controller,
//   Post,
//   Body,
//   Get,
//   Query,
//   UseGuards,
//   ParseUUIDPipe,
//   Patch,
//   Request,
// } from '@nestjs/common';
// import {
//   ApiTags,
//   ApiOperation,
//   ApiBearerAuth,
//   ApiQuery,
// } from '@nestjs/swagger';
// import { AttendanceService } from './attendance.service';
// import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
// import { RolesGuard } from '../common/guards/roles.guard';
// import { UserRole } from '../entities/user.entity';
// import { Roles } from '../common/guards/roles.decarator';
// import { MarkAttendanceDto } from './mark-attendance.dto';
// import { UpdateSingleAttendanceDto } from './update-single-attendance.dto';

// @ApiTags('Davomat (Attendance)')
// @ApiBearerAuth()
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Controller('attendance')
// export class AttendanceController {
//   constructor(private readonly attendanceService: AttendanceService) {}

//   @Get('sheet')
//   @Roles(UserRole.ADMIN, UserRole.TEACHER)
//   @ApiOperation({ summary: "Guruh talabalari ro'yxatini davomat uchun olish" })
//   @ApiQuery({ name: 'groupId', type: 'string' })
//   @ApiQuery({ name: 'date', example: '2026-02-14' })
//   async getSheet(
//     @Query('groupId', ParseUUIDPipe) groupId: string,
//     @Query('date') date: string,
//     @Request() req,
//   ) {
//     // ✅ role uzatildi
//     return this.attendanceService.getAttendanceSheet(
//       groupId,
//       date,
//       req.user.role,
//     );
//   }

//   @Post('bulk')
//   @Roles(UserRole.ADMIN, UserRole.TEACHER)
//   @ApiOperation({ summary: 'Davomatni ommaviy saqlash yoki yangilash' })
//   async markBulk(@Body() dto: MarkAttendanceDto, @Request() req) {
//     return this.attendanceService.markBulk(dto, req.user.role);
//   }

//   @Patch('single-update')
//   @Roles(UserRole.ADMIN, UserRole.TEACHER)
//   @ApiOperation({ summary: "Bitta talabaning davomatini tahrirlash" })
//   async updateSingle(
//     @Body() dto: UpdateSingleAttendanceDto,
//     @Request() req,
//   ) {
//     return this.attendanceService.updateSingleAttendance(dto, req.user.role);
//   }

//   @Get('monthly-report')
//   @Roles(UserRole.ADMIN, UserRole.TEACHER)
//   @ApiOperation({
//     summary: 'Guruhning oylik pivot davomat hisoboti',
//     description:
//       "Berilgan guruh va oy uchun har bir talabaning har bir dars kunida keldi yoki kelmadi holatini ko'rsatadigan pivot jadval.",
//   })
//   @ApiQuery({ name: 'groupId', type: 'string', required: true })
//   @ApiQuery({
//     name: 'month',
//     example: '2026-02',
//     required: false,
//     description: 'Sana berilmasa, joriy oy olinadi',
//   })
//   async getMonthlyReport(
//     @Query('groupId', ParseUUIDPipe) groupId: string,
//     @Query('month') month?: string,
//   ) {
//     return this.attendanceService.getGroupMonthlyAttendance(groupId, month);
//   }
// }

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
  ApiBody,
} from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../entities/user.entity';
import { Roles } from '../common/guards/roles.decarator';
import { MarkAttendanceDto } from './mark-attendance.dto';
import { UpdateSingleAttendanceDto } from './update-single-attendance.dto';

@ApiTags('Davomat (Attendance)')
@ApiBearerAuth() 
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('sheet')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: "Guruh talabalari ro'yxatini davomat uchun olish" })
  @ApiQuery({ name: 'groupId', type: 'string', })
  @ApiQuery({ name: 'date', example: '2026-02-14',  }) 
  async getSheet(
    @Query('groupId', ParseUUIDPipe) groupId: string,
    @Query('date') date: string,
    @Request() req,
  ) {
    return this.attendanceService.getAttendanceSheet(
      groupId,
      date,
      req.user.role,
    );
  }

  @Post('bulk')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Davomatni ommaviy saqlash yoki yangilash' })
  async markBulk(@Body() dto: MarkAttendanceDto, @Request() req) {
    return this.attendanceService.markBulk(dto, req.user.role);
  }

  @Patch('single-update')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Bitta talabaning davomatini tahrirlash' })
  async updateSingle(
    @Body() dto: UpdateSingleAttendanceDto,
    @Request() req,
  ) {
    return this.attendanceService.updateSingleAttendance(dto, req.user.role);
  }

  @Get('monthly-report')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Guruhning oylik pivot davomat hisoboti',
    description:
      "Berilgan guruh va oy uchun har bir talabaning har bir dars kunida keldi yoki kelmadi holatini ko'rsatadigan pivot jadval.",
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

  // ✅ YANGI — face-verify endpoint
  @Post('face-verify')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Yuz orqali davomat belgilash',
    description:
      "Kameradan olingan base64 rasm orqali talabani tanib davomatini belgilaydi. O'xshashlik 55%+ bo'lsa davomat belgilanadi.",
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['groupId', 'date', 'base64'],
      properties: {
        groupId: {
          type: 'string',
          format: 'uuid',
          example: '742e4b17-6478-4d58-bf87-9c3e8b6357cc',
        },
        date: {
          type: 'string',
          example: '2026-03-08',
          description: 'YYYY-MM-DD format',
        },
        base64: {
          type: 'string',
          example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgAB...',
          description: 'Kameradan olingan rasm',
        },
      },
    },
  })
  async faceVerify(
    @Body() body: { groupId: string; date: string; base64: string },
    @Request() req,
  ) {
    return this.attendanceService.faceVerifyAttendance(
      body.groupId,
      body.date,
      body.base64,
      req.user.role,
    );
  }
}