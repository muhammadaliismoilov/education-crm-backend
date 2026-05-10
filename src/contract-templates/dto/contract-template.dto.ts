import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContractTemplateDto {
  @ApiProperty({
    description: "Shartnoma shablonining nomi. Masalan: 'Ingliz tili kursi shartnomasi'.",
    example: 'Standard English Course Contract',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: "Shartnoma matni JSON formatida. " +
      "Avtomatik to'ldiriladigan maydonlar: {{studentName}}, {{contractNumber}}, {{branchName}}, {{date}}, {{parentName}}.",
    example: { title: 'Shartnoma №{{contractNumber}}', body: "{{studentName}} bilan {{branchName}} markazi o'rtasida..." },
  })
  @IsObject()
  @IsNotEmpty()
  content: Record<string, any>;
}

export class UpdateContractTemplateDto {
  @ApiPropertyOptional({ 
    description: 'Shartnoma shablonining yangilangan nomi.',
    example: 'Standard English Course Contract v2' 
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ 
    description: "Shartnomaning yangilangan JSON matni.",
    example: { title: 'Yangilangan Shartnoma', body: '{{studentName}}...' }
  })
  @IsObject()
  @IsOptional()
  content?: Record<string, any>;
}
