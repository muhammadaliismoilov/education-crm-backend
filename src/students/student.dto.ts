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

export class DiscountItemDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Guruh UUID si',
    format: 'uuid',
  })
  @IsUUID()
  groupId: string;

  @ApiProperty({
    example: 450000,
    description: "Imtiyozli narx (so'm). null yuborilsa imtiyoz bekor qilinadi",
    nullable: true,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  customPrice: number | null;
}

export class CreateStudentDto {
  @ApiProperty({
    example: 'Muxamadaliyev Ibroxim',
    description: "Talabaning to'liq ismi",
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  fullName: string;

  @ApiProperty({
    example: '+998900113861',
    description: 'Telefon raqami xalqaro formatda',
    pattern: '/^\\+998\\d{9}$/',
  })
  @Matches(/^\+998\d{9}$/, {
    message: "Telefon raqami +998XXXXXXXXX formatida bo'lishi shart",
  })
  phone: string;

  @ApiProperty({
    example: 'Karimov Baxtiyor',
    description: 'Ota-onasining ismi. Ixtiyoriy.',
    required: false,
  })
  @IsOptional()
  @IsString()
  parentName?: string;

  @ApiProperty({
    example: '+998901234567',
    description: 'Ota-onasining telefon raqami. Ixtiyoriy.',
    required: false,
    pattern: '/^\\+998\\d{9}$/',
  })
  @IsOptional()
  @Matches(/^\+998\d{9}$/)
  parentPhone?: string;

  @ApiProperty({
    enum: DocumentType,
    example: DocumentType.BIRTH_CERTIFICATE,
    description: 'Hujjat turi',
    default: DocumentType.BIRTH_CERTIFICATE,
    required: false,
  })
  @IsOptional()
  @IsEnum(DocumentType, {
    message: "DocumentType 'passport' yoki 'birth_certificate' bo'lishi kerak",
  })
  @IsString()
  documentType?: string;

  @ApiProperty({
    example: 'AB1234567',
    description:
      "Hujjat seriya va raqami (passport: AA1234567, tug'ilganlik: XII-AB-123456)",
    required: false,
  })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiProperty({
    example: '12345678901234',
    description: 'JSHSHIR — 14 xonali shaxsiy raqam',
    required: false,
    minLength: 14,
    maxLength: 14,
    pattern: '/^\\d{14}$/',
  })
  @IsOptional()
  @Matches(/^\d{14}$/, { message: "PINFL 14 xonali raqam bo'lishi shart" })
  pinfl?: string;

  @ApiProperty({
    example: '2000-01-15',
    description: "Tug'ilgan sana (YYYY-MM-DD)",
    required: false,
    pattern: '/^\\d{4}-\\d{2}-\\d{2}$/',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Tug'ilgan sana YYYY-MM-DD formatida bo'lishi kerak",
  })
  birthDate?: string;

  @ApiProperty({
    example: 'Backend',
    description: "O'qish yo'nalishi. Ixtiyoriy.",
    required: false,
  })
  @IsOptional()
  @IsString()
  direction?: string;

  @ApiProperty({
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    description: "Talaba qo'shiladigan guruhlar UUID lari. Kamida 1 ta.",
    minItems: 1,
    format: 'uuid',
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

  @ApiProperty({ required: false, type: 'string', format: 'binary' })
  @IsOptional()
  photo?: any;

  @ApiProperty({
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    description: "Yangilangan guruhlar ro'yxati. Kamida 1 ta qolishi shart.",
    required: false,
    minItems: 1,
  })
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

  @ApiProperty({
    type: [DiscountItemDto],
    description: "Guruhlar bo'yicha imtiyozli narxlar ro'yxati. Ixtiyoriy.",
    required: false,
    example: [
      { groupId: '550e8400-e29b-41d4-a716-446655440000', customPrice: 450000 },
    ],
  })
  @IsOptional()
  // @IsArray()
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
