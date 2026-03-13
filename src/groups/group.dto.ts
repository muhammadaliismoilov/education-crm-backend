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
  @ApiProperty({ example: 'Node.js Backend' })
  @IsString()
  @IsNotEmpty({ message: "Guruh nomi bo'sh bo'lmasligi kerak" })
  name: string;

  @ApiProperty({ example: ['Dushanba', 'Chorshanba', 'Juma'] })
  @IsArray()
  @ArrayMinSize(1, { message: "Kamida bitta kun tanlanishi kerak" })
  @IsString({ each: true })
  days: string[];

  @ApiProperty({ example: '14:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: "Vaqt HH:MM formatida bo'lishi kerak" })
  startTime: string;

  @ApiProperty({ example: '16:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: "Vaqt HH:MM formatida bo'lishi kerak" })
  endTime: string;

  @ApiProperty({ example: 800000 })
  @IsNumber()
  @Min(1, { message: "Narx 0 dan katta bo'lishi kerak" })
  price: number;

  @ApiProperty({ example: 'teacherID' })
  @IsUUID()
  teacherId: string;
}

export class UpdateGroupDto extends PartialType(CreateGroupDto) {}