// payment.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({
    example: 500000,
    description: "To'lov summasi (so'm). 0 dan katta bo'lishi kerak.",
    minimum: 1,
  })
  @IsNumber()
  @Min(1, { message: "To'lov miqdori 0 dan katta bo'lishi kerak" })
  amount: number;

  @ApiProperty({
    example: '2026-03-13',
    description: "To'lov sanasi (YYYY-MM-DD)",
    pattern: '/^\\d{4}-\\d{2}-\\d{2}$/',
  })
  @IsString()
  @IsNotEmpty({ message: "To'lov sanasi bo'sh bo'lmasligi kerak" })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Sana YYYY-MM-DD formatida bo'lishi kerak",
  })
  paymentDate: string;

  @ApiProperty({
    example: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
    description: 'Talaba UUID si',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty({ message: "Student ID bo'sh bo'lmasligi kerak" })
  studentId: string;

  @ApiProperty({
    example: 'bb096922-6249-4911-9a8c-9a503bb3e7d9',
    description: 'Guruh UUID si',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty({ message: "Group ID bo'sh bo'lmasligi kerak" })
  groupId: string;
}

export class UpdatePaymentDto extends PartialType(CreatePaymentDto) {}
