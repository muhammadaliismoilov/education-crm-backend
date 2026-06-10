import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExpenseDto {
  @ApiProperty({
    example: 500000,
    description: "Xarajat miqdori (so'm)",
    minimum: 1,
  })
  @Type(() => Number)
  @IsNumber({}, { message: "Miqdor son bo'lishi kerak" })
  @IsPositive({ message: "Miqdor musbat bo'lishi kerak" })
  @Min(1)
  amount: number;

  @ApiProperty({
    example: 'Ofis ijarasi',
    description: 'Xarajat sababi / nimaga ishlatilgan',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty({ message: "Sabab bo'sh bo'lmasligi kerak" })
  @MaxLength(500, { message: 'Sabab 500 belgidan oshmasligi kerak' })
  description: string;

  @ApiProperty({
    example: '2026-05-01',
    description: 'Xarajat sanasi (YYYY-MM-DD). Berilmasa bugungi sana olinadi.',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: "Sana formati noto'g'ri (YYYY-MM-DD)" })
  expenseDate?: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: "Filial ID si (faqat Superadmin to'ldirishni talab qiladi)",
    required: false,
  })
  @IsOptional()
  @IsString()
  branchId?: string;
}

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}

export class ExpenseFilterDto {
  @ApiProperty({ required: false, example: 1, description: 'Sahifa raqami' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiProperty({
    required: false,
    example: 10,
    description: 'Sahifadagi elementlar soni',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 10;

  @ApiProperty({
    required: false,
    example: '2026-01',
    description:
      'Oylik filter (YYYY-MM formatida). Berilmasa barchasi qaytadi.',
  })
  @IsOptional()
  @IsString()
  month?: string;

  @ApiProperty({
    required: false,
    example: '2026',
    description: 'Yillik filter (YYYY formatida)',
  })
  @IsOptional()
  @IsString()
  year?: string;

  @ApiProperty({
    required: false,
    description: 'Filial ID si (faqat Superadmin uchun)',
  })
  @IsOptional()
  @IsString()
  branchId?: string;
}
