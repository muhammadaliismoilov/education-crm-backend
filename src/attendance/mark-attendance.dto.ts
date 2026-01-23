import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNotEmpty, IsString, IsUUID } from 'class-validator';

class StudentAttendanceDto {
  @ApiProperty({ example: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8' })
  @IsUUID()
  studentId: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  isPresent: boolean;
}

export class MarkAttendanceDto {
  @ApiProperty({ example: 'bb096922-6249-4911-9a8c-9a503bb3e7d9' })
  @IsUUID()
  @IsNotEmpty()
  groupId: string;

  @ApiProperty({ example: '2026-01-23' })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ type: [StudentAttendanceDto] })
  @IsArray()
  students: StudentAttendanceDto[];
}