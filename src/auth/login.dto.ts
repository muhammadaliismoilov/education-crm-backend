// login.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'admins',
    description: 'Foydalanuvchi logini (kamida 4 belgi)',
    minLength: 4,
  })
  @IsString({ message: "Login satr bo'lishi kerak" })
  @IsNotEmpty({ message: "Login bo'sh bo'lmasligi kerak" })
  login: string;

  @ApiProperty({
    example: 'adminadmin',
    description: 'Foydalanuvchi paroli (kamida 6 belgi)',
    minLength: 6,
  })
  @IsString({ message: "Parol satr bo'lishi kerak" })
  @IsNotEmpty({ message: "Parol bo'sh bo'lmasligi kerak" })
  @MinLength(6, { message: "Parol kamida 6 ta belgidan iborat bo'lishi kerak" })
  password: string;
}
