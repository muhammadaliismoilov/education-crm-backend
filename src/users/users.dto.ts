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
import { UserRole } from 'src/entities/user.entity';

export class CreateUserDto {
  @ApiProperty({ example: 'Ali Valiyev' })
  @IsString()
  @IsNotEmpty({ message: "Ism-familiya bo'sh bo'lmasligi kerak" })
  fullName: string;

  @ApiProperty({
    example: '+998901234567',
    description: "Telefon raqami xalqaro formatda bo'lishi shart",
  })
  @Matches(/^\+998\d{9}$/, {
    message: "Raqam +998XXXXXXXXX formatida bo'lishi kerak",
  })
  phone: string;
  @ApiProperty({ example: 'ali_dev' })
  @IsString()
  @MinLength(4, { message: "Login kamida 4 ta belgidan iborat bo'lishi kerak" })
  login: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6, { message: "Parol kamida 6 ta belgidan iborat bo'lishi kerak" })
  password: string;

  @ApiProperty({ enum: UserRole, default: UserRole.STUDENT })
  @IsEnum(UserRole, { message: "Noto'g'ri rol tanlandi" })
  role: UserRole;

  @ApiProperty({ required: false, example: 30 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100) // O'qituvchi ulushi 100% dan oshmasligi kerak
  salaryPercentage?: number;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}
