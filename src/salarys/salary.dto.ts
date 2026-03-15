// salary.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

export class PaySalaryDto {
  @ApiProperty({
    example: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
    description: "O'qituvchi UUID si",
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty({ message: "O'qituvchi ID bo'sh bo'lmasligi kerak" })
  teacherId: string;

  @ApiProperty({
    example: '2026-03',
    description: 'Oylik qaysi oy uchun berilayotgani (YYYY-MM)',
    pattern: '/^\\d{4}-\\d{2}$/',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}$/, { message: "Format YYYY-MM bo'lishi shart" })
  month: string;

  @ApiProperty({
    example: 2400000,
    description: "To'lov miqdori (so'm). 0 dan katta bo'lishi kerak.",
    minimum: 1,
  })
  @IsNumber()
  @Min(1, { message: "To'lov miqdori 0 dan katta bo'lishi kerak" })
  // TUZATISH: @Min(0) → @Min(1) — 0 so'm to'lov mantiqsiz
  amount: number;
}

export class UpdateSalaryDto {
  @ApiProperty({
    example: 1500000,
    description: "Yangi to'lov miqdori (so'm). 0 dan katta bo'lishi kerak.",
    minimum: 1,
  })
  @IsNumber()
  @Min(1, { message: "To'lov miqdori 0 dan katta bo'lishi kerak" })
  amount: number;
}
