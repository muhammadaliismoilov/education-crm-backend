import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @ApiProperty({
    example: 'Ali Valiyev',
    description: "Foydalanuvchining to'liq ismi",
  })
  @IsString()
  @IsNotEmpty({ message: "Ism-familiya bo'sh bo'lmasligi kerak" })
  fullName: string;

  @ApiProperty({
    example: '+998901234567',
    description: "Telefon raqami xalqaro formatda (+998XXXXXXXXX)",
    pattern: '/^\\+998\\d{9}$/',
  })
  @Matches(/^\+998\d{9}$/, {
    message: "Raqam +998XXXXXXXXX formatida bo'lishi kerak",
  })
  phone: string;

  @ApiProperty({
    example: 'educrm',
    description: 'Tizimga kirish uchun login (kamida 4 belgi)',
    minLength: 4,
  })
  @IsString()
  @IsNotEmpty({ message: "Login bo'sh bo'lmasligi kerak" })
  @MinLength(4, { message: "Login kamida 4 ta belgidan iborat bo'lishi kerak" })
  login: string;

  @ApiProperty({
    example: 'password123',
    description: 'Parol (kamida 6 belgi)',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: "Parol bo'sh bo'lmasligi kerak" })
  @MinLength(6, { message: "Parol kamida 6 ta belgidan iborat bo'lishi kerak" })
  password: string;

  @ApiProperty({
    example: UserRole.TEACHER,
    description: 'Foydalanuvchi roli',
    enum: UserRole,
    default: UserRole.TEACHER,
  })
  @IsEnum(UserRole, { message: "Noto'g'ri rol tanlandi" })
  role: UserRole;

  @ApiProperty({
    example: 30,
    description: "O'qituvchi oylik foizi (0-100%). Ixtiyoriy.",
    required: false,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  salaryPercentage?: number;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({
    required: false,
    description: "Yangi parol. Bo'sh bo'lmasligi kerak.",
    minLength: 6,
    example: 'newPassword123',
  })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: "Parol kamida 6 ta belgidan iborat bo'lishi kerak" })
  password?: string;
}