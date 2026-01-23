import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsString, IsUUID } from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({ example: 'Node.js Backend' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: ['Dushanba', 'Chorshanba', 'Juma'] })
  @IsArray()
  @IsString({ each: true }) // Har bir element string bo'lishi shart
  days: string[];

  @ApiProperty({ example: '14:00' })
  @IsString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({ example: 800000 })
  @IsNumber()
  price: number;

  @ApiProperty({ example: 'teacherid' })
  @IsUUID()
  @IsNotEmpty()
  teacherId: string; // O'qituvchi ID-si endi UUID
}

export class UpdateGroupDto extends PartialType(CreateGroupDto) {}