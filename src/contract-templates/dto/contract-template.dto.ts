import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
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
    description: "Shartnoma matni. HTML formatini qo'llab-quvvatlaydi. " +
      "Avtomatik to'ldiriladigan maydonlar: {{studentName}}, {{contractNumber}}, {{branchName}}, {{date}}, {{parentName}}.",
    example: '<h1>Shartnoma №{{contractNumber}}</h1><p>{{studentName}} bilan {{branchName}} markazi o\'rtasida...</p>',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
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
    description: "Shartnomaning yangilangan HTML matni.",
    example: '<h1>Yangilangan Shartnoma</h1><p>{{studentName}}...</p>'
  })
  @IsString()
  @IsOptional()
  content?: string;
}
