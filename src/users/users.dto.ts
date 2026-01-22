import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from 'src/entities/user.entity';


export class CreateUserDto {
  @ApiProperty({ example: 'Ali Valiyev' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: '+998901234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'ali_dev' })
  @IsString()
  @IsNotEmpty()
  login: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: UserRole, default: UserRole.STUDENT })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiProperty({  required: false })
  @IsNumber()
  @IsOptional()
  salaryPercentage?: number;
}

export class UpdateUserDto extends CreateUserDto {}