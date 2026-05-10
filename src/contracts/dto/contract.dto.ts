import { IsString, IsNotEmpty, IsOptional, IsUUID, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContractDto {
  @ApiProperty({ 
    description: "Shartnoma nomi. Masalan: 'Ali Karimov - Frontend kursi shartnomasi'.",
    example: 'Ali Karimov - Contract'
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ 
    description: "Shartnoma biriktirilayotgan o'quvchining unikal identifikatori (UUID).",
    example: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
    format: 'uuid'
  })
  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @ApiPropertyOptional({
    description: "Shartnoma matni. Agar 'templateId' berilsa, ushbu maydon shablon asosida avtomatik to'ldiriladi. JSON formatida bo'lishi kutiladi.",
    example: { title: 'Shartnoma', body: '...' }
  })
  @IsObject()
  @IsOptional()
  content?: Record<string, any>;

  @ApiPropertyOptional({
    description: "Yuklangan shartnoma faylining manzili (URL). Agar tayyor PDF fayl bo'lsa ishlatiladi.",
    example: 'https://storage.example.com/contracts/contract-123.pdf'
  })
  @IsString()
  @IsOptional()
  fileUrl?: string;

  @ApiPropertyOptional({
    description: "Shartnoma yaratishda foydalaniladigan shablonning UUID identifikatori.",
    example: 'bb096922-6249-4911-9a8c-9a503bb3e7d9',
    format: 'uuid'
  })
  @IsUUID()
  @IsOptional()
  templateId?: string;
}

export class UpdateContractDto {
  @ApiPropertyOptional({ 
    description: 'Shartnomaning yangilangan nomi.',
    example: 'Ali Karimov - Updated Contract'
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: "Shartnomaning yangilangan matni. JSON formatida bo'lishi kutiladi. DIQQAT: Faqat 'DRAFT' holatidagi shartnomalarni tahrirlash mumkin.",
    example: { title: 'Yangilangan Shartnoma', body: '...' }
  })
  @IsObject()
  @IsOptional()
  content?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Yuklangan fayl manzili' })
  @IsString()
  @IsOptional()
  fileUrl?: string;
}
