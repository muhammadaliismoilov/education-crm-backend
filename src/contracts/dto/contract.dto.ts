import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContractContentDto } from '../../contract-templates/dto/contract-template.dto';

export class CreateContractDto {
  @ApiProperty({
    description: "Shartnoma nomi.",
    example: 'Ali Karimov - Frontend kursi shartnomasi',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({
    description: "O'quvchining UUID identifikatori.",
    example: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @ApiPropertyOptional({
    description:
      "Shartnoma matni. Agar 'templateId' berilsa, ushbu maydon shablon asosida avtomatik to'ldiriladi.",
    type: ContractContentDto,
  })
  @ValidateNested()
  @IsOptional()
  @Type(() => ContractContentDto)
  content?: ContractContentDto;

  @ApiPropertyOptional({
    description: 'Tayyor PDF fayl URL manzili (faqat HTTPS).',
    example: 'https://storage.example.com/contracts/contract-123.pdf',
  })
  @IsUrl({ protocols: ['https'], require_tld: true })
  @IsOptional()
  fileUrl?: string;

  @ApiPropertyOptional({
    description: "Shartnoma yaratishda foydalaniladigan shablonning UUID identifikatori.",
    example: 'bb096922-6249-4911-9a8c-9a503bb3e7d9',
    format: 'uuid',
  })
  @IsUUID()
  @IsOptional()
  templateId?: string;
}

export class UpdateContractDto {
  @ApiPropertyOptional({
    description: 'Shartnomaning yangilangan nomi.',
    example: 'Ali Karimov - Updated Contract',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    description:
      "Shartnomaning yangilangan matni. DIQQAT: Faqat 'DRAFT' holatidagi shartnomalarni tahrirlash mumkin.",
    type: ContractContentDto,
  })
  @ValidateNested()
  @IsOptional()
  @Type(() => ContractContentDto)
  content?: ContractContentDto;

  @ApiPropertyOptional({
    description: 'Yangilangan fayl URL manzili (faqat HTTPS).',
  })
  @IsUrl({ protocols: ['https'], require_tld: true })
  @IsOptional()
  fileUrl?: string;
}
