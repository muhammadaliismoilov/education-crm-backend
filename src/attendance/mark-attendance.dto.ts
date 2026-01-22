import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNotEmpty, IsString, IsUUID } from 'class-validator';

class StudentAttendanceDto {
  @ApiProperty({ example: 'uuid-student-id' })
  @IsUUID()
  studentId: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  isPresent: boolean;
}

export class MarkAttendanceDto {
  @ApiProperty({ example: 'uuid-group-id' })
  @IsUUID()
  groupId: string;

  @ApiProperty({ example: '2026-01-22' })
  @IsString()
  date: string;

  @ApiProperty({ type: [StudentAttendanceDto] })
  @IsArray()
  students: StudentAttendanceDto[];
}