// group.dto.ts
import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Min,
  Matches,
  ArrayMinSize,
} from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({
    example: 'Node.js Backend',
    description: 'Guruh nomi',
  })
  @IsString()
  @IsNotEmpty({ message: "Guruh nomi bo'sh bo'lmasligi kerak" })
  name: string;

  @ApiProperty({
    example: ['Dushanba', 'Chorshanba', 'Juma'],
    description: 'Dars kunlari. Kamida 1 ta.',
    type: [String],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Kamida bitta kun tanlanishi kerak' })
  @IsString({ each: true })
  days: string[];

  @ApiProperty({
    example: '14:00',
    description: 'Dars boshlanish vaqti (HH:MM)',
    pattern: '/^\\d{2}:\\d{2}$/',
  })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: "Vaqt HH:MM formatida bo'lishi kerak" })
  startTime: string;

  @ApiProperty({
    example: '16:00',
    description: 'Dars tugash vaqti (HH:MM)',
    pattern: '/^\\d{2}:\\d{2}$/',
  })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: "Vaqt HH:MM formatida bo'lishi kerak" })
  endTime: string;

  @ApiProperty({
    example: 800000,
    description: "Oylik kurs narxi (so'm). 0 dan katta bo'lishi kerak.",
    minimum: 1,
  })
  @IsNumber()
  @Min(1, { message: "Narx 0 dan katta bo'lishi kerak" })
  price: number;

  @ApiProperty({
    example: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
    description: "O'qituvchi UUID si",
    format: 'uuid',
  })
  @IsUUID()
  teacherId: string;
}

export class UpdateGroupDto extends PartialType(CreateGroupDto) {}
