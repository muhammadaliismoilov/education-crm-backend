import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString, IsUUID, Matches } from 'class-validator';

export class UpdateSingleAttendanceDto {
  @ApiProperty({ example: 'bb096922-6249-4911-9a8c-9a503bb3e7d9' })
  @IsUUID()
  @IsNotEmpty({ message: "Guruh ID bo'sh bo'lmasligi kerak" })
  groupId: string;

  @ApiProperty({ example: '2026-01-25' })
  @IsString()
  @IsNotEmpty({ message: "Sana bo'sh bo'lmasligi kerak" })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Sana YYYY-MM-DD formatida bo\'lishi kerak' })
  date: string;

  @ApiProperty({ example: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8' })
  @IsUUID()
  @IsNotEmpty({ message: "Talaba ID bo'sh bo'lmasligi kerak" })
  studentId: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  isPresent: boolean;
}