import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsUUID,
  IsString,
  Matches,
  Min,
} from 'class-validator';

import { PartialType } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({ example: 500000, description: 'To‘lov summasi' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    example: '2026-01-26',
    description: 'To‘lov sanasi (YYYY-MM-DD)',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Sana YYYY-MM-DD formatida bo'lishi kerak",
  })
  paymentDate: string;

  @ApiProperty({ example: 'user-uuid-here' })
  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({ example: 'group-uuid-here' })
  @IsUUID()
  @IsNotEmpty()
  groupId: string;
}

export class UpdatePaymentDto extends PartialType(CreatePaymentDto) {}
