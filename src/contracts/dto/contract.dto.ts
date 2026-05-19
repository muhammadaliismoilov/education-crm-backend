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
    description:
      "Shartnoma nomi. Ro'yxat va detail sahifalarda ko'rsatiladi. Avtomatik contractlarda backend student ismidan nom beradi.",
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
      "Shartnoma matni. 'templateId' berilsa, content yuborish shart emas — backend shablonni real student ma'lumotlari bilan to'ldiradi. Agar templateId berilmasa, content tayyor holatda yuborilishi mumkin.",
    type: ContractContentDto,
  })
  @ValidateNested()
  @IsOptional()
  @Type(() => ContractContentDto)
  content?: ContractContentDto;

  @ApiPropertyOptional({
    description:
      "Tayyor PDF/fayl URL manzili (faqat HTTPS). Bu holatda contract record yaratiladi, lekin backend PDF generatsiyasi faqat 'content' bor shartnomalarda ishlaydi.",
    example: 'https://storage.example.com/contracts/contract-123.pdf',
  })
  @IsUrl({ protocols: ['https'], require_tld: true })
  @IsOptional()
  fileUrl?: string;

  @ApiPropertyOptional({
    description:
      "Shartnoma yaratishda foydalaniladigan shablon UUID'i. Template shu filialga tegishli bo'lishi kerak.",
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
      "Shartnomaning yangilangan matni. DIQQAT: faqat 'DRAFT' holatidagi shartnomalarni tahrirlash mumkin. APPROVED/SIGNED contractlarda 400 qaytadi.",
    type: ContractContentDto,
  })
  @ValidateNested()
  @IsOptional()
  @Type(() => ContractContentDto)
  content?: ContractContentDto;

  @ApiPropertyOptional({
    description:
      "Yangilangan fayl URL manzili (faqat HTTPS). Faqat 'DRAFT' contractda o'zgartirish mumkin.",
  })
  @IsUrl({ protocols: ['https'], require_tld: true })
  @IsOptional()
  fileUrl?: string;
}
