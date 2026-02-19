import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  IsArray,
  IsUUID,
  ArrayMinSize,
  IsEAN,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { DocumentType } from 'src/entities/students.entity';


export class CreateStudentDto {
  @ApiProperty({ example: 'Muxamadaliyev Ibroxim' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim()) // Bo'sh joylarni avtomatik o'chiradi
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
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "Tug'ilgan sana YYYY-MM-DD formatida bo'lishi kerak" })
  birthDate?: Date;

  @ApiProperty({ example: 'Matematika', required: false })
  @IsOptional()
  @IsString()
  direction?: string;

  @ApiProperty({
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    description: 'Kamida bitta guruh ID-si yuborilishi shart',
  })
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayMinSize(1, {
    message: "O'quvchini kamida bitta guruhga biriktirish shart",
  })
  groupIds: string[];
}

export class UpdateStudentDto extends PartialType(CreateStudentDto) {
  @ApiProperty({
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayMinSize(1, { message: "O'quvchi kamida bitta guruhda qolishi kerak" })
  groupIds?: string[];
}
