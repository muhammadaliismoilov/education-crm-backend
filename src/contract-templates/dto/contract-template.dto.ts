import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Shartnoma matnining aniq tuzilmasi (typed schema).
 * `Record<string, any>` o'rniga ishlatiladi — Prototype Pollution va
 * noaniq inputlardan himoya qiladi.
 */
export class ContractContentDto {
  @ApiProperty({
    description:
      'Shartnoma sarlavhasi. PDFda sarlavha sifatida chiqadi. Placeholder ishlatish mumkin: {{contractNumber}}, {{studentName}}, {{date}}.',
    example: 'SHARTNOMA №{{contractNumber}}',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title: string;

  @ApiProperty({
    description:
      "Shartnoma asosiy matni. PDFda asosiy matn sifatida chiqadi. Qo'llab-quvvatlanadigan placeholderlar: " +
      '{{studentName}}, {{parentName}}, {{studentPhone}}, {{parentPhone}}, {{contractNumber}}, {{date}}, {{branchName}}, {{documentNumber}}, {{pinfl}}, {{birthDate}}, {{direction}}.',
    example:
      "{{date}} sanasida {{branchName}} va {{studentName}} o'rtasida shartnoma tuzildi. Ota-ona: {{parentName}}, tel: {{parentPhone}}.",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  body: string;

  @ApiPropertyOptional({
    description:
      'Shartnoma pastki qismi (footer). PDFda imzo va sana qismi sifatida chiqadi. Ixtiyoriy.',
    example:
      'Markaz vakili: ___________\nOta-ona/Talaba: ___________\nSana: {{date}}',
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  footer?: string;
}

export class CreateContractTemplateDto {
  @ApiProperty({
    description:
      "Shartnoma shablonining ichki nomi. Frontend ro'yxatda shu nomni ko'rsatadi.",
    example: 'Standard English kursi shartnomasi',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({
    description:
      "Shartnoma matni tuzilgan JSON formatida. Avtomatik to'ldiriladigan maydonlar: " +
      '{{studentName}}, {{parentName}}, {{studentPhone}}, {{parentPhone}}, {{contractNumber}}, {{date}}, {{branchName}}, {{documentNumber}}, {{pinfl}}, {{birthDate}}, {{direction}}. ' +
      'Yaratilgan shartnomada placeholderlar real qiymatlar bilan almashtiriladi.',
    type: ContractContentDto,
  })
  @ValidateNested()
  @Type(() => ContractContentDto)
  content: ContractContentDto;
}

export class UpdateContractTemplateDto {
  @ApiPropertyOptional({
    description: 'Shartnoma shablonining yangilangan nomi.',
    example: 'Standard English Course Contract v2',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    description: 'Shartnomaning yangilangan matni.',
    type: ContractContentDto,
  })
  @ValidateNested()
  @IsOptional()
  @Type(() => ContractContentDto)
  content?: ContractContentDto;
}
