// mark-attendance.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
  ArrayMinSize,
  IsOptional,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class StudentAttendanceDto {
  @ApiProperty({
    example: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
    description: 'Talaba UUID si',
    format: 'uuid',
  })
  @IsUUID()
  studentId: string;

  @ApiProperty({
    example: true,
    description: 'Keldi (true), kelmadi (false), belgilanmagan (null)',
    nullable: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => (value === null || value === undefined ? null : Boolean(value)))
  isPresent: boolean | null;
}

export class MarkAttendanceDto {
  @ApiProperty({
    example: 'bb096922-6249-4911-9a8c-9a503bb3e7d9',
    description: 'Guruh UUID si',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  groupId: string;

  @ApiProperty({
    example: '2026-03-13',
    description: 'Davomat sanasi (YYYY-MM-DD)',
    pattern: '/^\\d{4}-\\d{2}-\\d{2}$/',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Sana YYYY-MM-DD formatida bo'lishi kerak",
  })
  date: string;

  @ApiProperty({
    type: [StudentAttendanceDto],
    description: "Talabalar davomati ro'yxati. Kamida 1 ta.",
    minItems: 1,
  })
  @IsArray()
  // TUZATISH: @ArrayMinSize(1) yo'q edi — bo'sh array yuborilsa o'tib ketardi
  @ArrayMinSize(1, { message: "Kamida 1 ta talaba davomati kiritilishi kerak" })
  @ValidateNested({ each: true })
  @Type(() => StudentAttendanceDto)
  students: StudentAttendanceDto[];

  @ApiProperty({
    example: 41.387065,
    description: "O'qituvchining hozirgi kenglik koordinatasi (latitude)",
    required: false,
  })
  @IsOptional()
  latitude?: number;

  @ApiProperty({
    example: 60.389046,
    description: "O'qituvchining hozirgi uzunlik koordinatasi (longitude)",
    required: false,
  })
  @IsOptional()
  longitude?: number;
}