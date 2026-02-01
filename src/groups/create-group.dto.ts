import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({ example: 'Node.js Backend' })
  @IsString()
  @IsNotEmpty({ message: "Guruh nomi bo'sh bo'lmasligi kerak" })
  name: string;

  @ApiProperty({ example: ['Dushanba', 'Chorshanba', 'Juma'] })
  @IsArray()
  @IsString({ each: true }) // Har bir element string bo'lishi shart
  days: string[];

  @ApiProperty({ example: '14:00' })
  @IsString()
  @IsNotEmpty({ message: "Boshlanish vaqti bo'sh bo'lmasligi kerak" })
  startTime: string;

  @ApiProperty({ example: 800000 })
  @IsNumber()
  @IsNotEmpty({ message: "Narx bo'sh bo'lmasligi kerak" })
  price: number;

  @ApiProperty({ example: 'teacherID' })
  @IsUUID()
  @IsNotEmpty({ message: "O'qituvchi ID bo'sh bo'lmasligi kerak" })
  teacherId: string;
}

export class UpdateGroupDto extends PartialType(CreateGroupDto) {}
