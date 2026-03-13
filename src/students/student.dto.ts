import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  IsArray,
  IsUUID,
  ArrayMinSize,
  IsEnum,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { DocumentType } from '../entities/students.entity';

// — Imtiyoz DTO
export class DiscountItemDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Guruh ID si',
  })
  @IsUUID()
  groupId: string;

  @ApiProperty({
    example: 450000,
    description: 'Imtiyozli narx. null yuborilsa imtiyoz bekor qilinadi',
    nullable: true,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  customPrice: number | null;
}

export class CreateStudentDto {
  @ApiProperty({ example: 'Muxamadaliyev Ibroxim' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  fullName: string;

  @ApiProperty({ example: '+998900113861' })
  @Matches(/^\+998\d{9}$/, {
    message: "Telefon raqami +998XXXXXXXXX formatida bo'lishi shart",
  })
  phone: string;

  @ApiProperty({ example: 'Ota-onasi ismi', required: false })
  @IsOptional()
  @IsString()
  parentName?: string;

  @ApiProperty({ example: '+998901234567', required: false })
  @IsOptional()
  @Matches(/^\+998\d{9}$/)
  parentPhone?: string;

  @ApiProperty({
    enum: DocumentType,
    default: DocumentType.BIRTH_CERTIFICATE,
    required: false,
  })
  @IsOptional()
  @IsEnum(DocumentType, {
    message: "DocumentType 'PASSPORT' yoki 'BIRTH_CERTIFICATE' bo'lishi kerak",
  })
  @IsString()
  documentType?: string;

  @ApiProperty({ example: 'AB1234567', required: false })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiProperty({ example: '12345678901234', required: false })
  @IsOptional()
  @Matches(/^\d{14}$/, { message: "PINFL 14 xonali raqam bo'lishi shart" })
  pinfl?: string;

  @ApiProperty({ example: '2000-01-01', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Tug'ilgan sana YYYY-MM-DD formatida bo'lishi kerak",
  })
  birthDate?: string; // ← Date emas, string!

  @ApiProperty({ example: 'Matematika', required: false })
  @IsOptional()
  @IsString()
  direction?: string;

  @ApiProperty({
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayMinSize(1, {
    message: "O'quvchini kamida bitta guruhga biriktirish shart",
  })
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [value];
    return value;
  })
  groupIds: string[];
}

export class UpdateStudentDto extends PartialType(CreateStudentDto) {
  // student.dto.ts — UpdateStudentDto ichida
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayMinSize(1, { message: "O'quvchi kamida bitta guruhda qolishi kerak" })
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [value];
      }
    }
    return value;
  })
  groupIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscountItemDto)
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
  discounts?: DiscountItemDto[];
}
