import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
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
    description: 'Shartnoma sarlavhasi. Placeholder: {{contractNumber}}',
    example: 'Shartnoma №{{contractNumber}}',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title: string;

  @ApiProperty({
    description:
      "Shartnoma asosiy matni. Placeholderlar: {{studentName}}, {{parentName}}, {{studentPhone}}, {{date}}, {{branchName}}.",
    example: "{{studentName}} bilan {{branchName}} markazi o'rtasida...",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  body: string;

  @ApiPropertyOptional({
    description: 'Shartnoma pastki qismi (footer). Ixtiyoriy.',
    example: "Imzo: ___________",
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  footer?: string;
}

export class CreateContractTemplateDto {
  @ApiProperty({
    description: "Shartnoma shablonining nomi.",
    example: 'Standard English Course Contract',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({
    description:
      "Shartnoma matni tuzilgan JSON formatida. Avtomatik to'ldiriladigan maydonlar: " +
      '{{studentName}}, {{contractNumber}}, {{branchName}}, {{date}}, {{parentName}}, {{studentPhone}}.',
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
    description: "Shartnomaning yangilangan matni.",
    type: ContractContentDto,
  })
  @ValidateNested()
  @IsOptional()
  @Type(() => ContractContentDto)
  content?: ContractContentDto;
}
