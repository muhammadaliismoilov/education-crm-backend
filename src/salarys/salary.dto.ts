import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsUUID, Matches, Min } from 'class-validator';

export class PaySalaryDto {
  @ApiProperty({ example: 'teacherID' })
  @IsUUID()
  @IsNotEmpty({ message: "O'qituvchi ID bo'sh bo'lmasligi kerak" })
  teacherId: string;

  @ApiProperty({ example: '2026-01', description: 'Oylik qaysi oy uchun berilayotgani' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}$/, { message: 'Format YYYY-MM bo\'lishi shart' })
  month: string;

  @ApiProperty({ example: 5000000 })
  @IsNumber()
  @Min(0)
  amount: number;
}