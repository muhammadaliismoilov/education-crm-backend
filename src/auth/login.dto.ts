import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ 
    example: 'admin', 
    description: 'Foydalanuvchi logini' 
  })
  @IsString({ message: 'Login satr bo\'lishi kerak' })
  @IsNotEmpty({ message: 'Login bo\'sh bo\'lmasligi kerak' })
  login: string;

  @ApiProperty({ 
    example: 'admin777', 
    description: 'Foydalanuvchi paroli' 
  })
  @IsString({ message: 'Parol satr bo\'lishi kerak' })
  @IsNotEmpty({ message: 'Parol bo\'sh bo\'lmasligi kerak' })
  @MinLength(6, { message: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak' })
  password: string;
}