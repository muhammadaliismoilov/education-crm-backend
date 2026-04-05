import { IsString, IsOptional, IsBoolean, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBranchDto {
  @ApiProperty({ example: 'Tashkent Branch', description: 'Filial nomi' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Chilonzor tumani, ...', description: 'Filial manzili' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: '+998901234567', description: 'Filial telefon raqami' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'tashkent', description: 'Filial subdomeni' })
  @IsString()
  @IsOptional()
  subdomain?: string;

  @ApiPropertyOptional({ example: 'tashkent.crm.uz', description: 'Filial maxsus domeni' })
  @IsString()
  @IsOptional()
  customDomain?: string;

  @ApiPropertyOptional({ example: 41.2995, description: 'Filial kengligi (latitude)' })
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: 69.2401, description: 'Filial uzunligi (longitude)' })
  @IsOptional()
  longitude?: number;
}

export class UpdateBranchDto {
  @ApiPropertyOptional({ example: 'Tashkent Branch', description: 'Filial nomi' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Chilonzor tumani, ...', description: 'Filial manzili' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: '+998901234567', description: 'Filial telefon raqami' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'tashkent', description: 'Filial subdomeni' })
  @IsString()
  @IsOptional()
  subdomain?: string;

  @ApiPropertyOptional({ example: 'tashkent.crm.uz', description: 'Filial maxsus domeni' })
  @IsString()
  @IsOptional()
  customDomain?: string;

  @ApiPropertyOptional({ example: true, description: 'Filial faol holati' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 41.2995, description: 'Filial kengligi (latitude)' })
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: 69.2401, description: 'Filial uzunligi (longitude)' })
  @IsOptional()
  longitude?: number;
}

export class CreateBranchWithAdminDto {
  // ── Branch ma'lumotlari ──────────────────────
  @ApiProperty({ example: 'TestPro O\'quv Markazi', description: 'Filial nomi' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Chilonzor tumani', description: 'Manzil' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: '+998901234567', description: 'Telefon' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'testpro', description: 'Subdomen (testpro.crm.uz)' })
  @IsString()
  @IsOptional()
  subdomain?: string;

  @ApiPropertyOptional({ example: 'testpro.crm.uz', description: 'Maxsus domen' })
  @IsString()
  @IsOptional()
  customDomain?: string;

  @ApiPropertyOptional({ example: 41.2995, description: 'Filial kengligi (latitude)' })
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: 69.2401, description: 'Filial uzunligi (longitude)' })
  @IsOptional()
  longitude?: number;

  // ── Admin ma'lumotlari ───────────────────────
  @ApiProperty({ example: 'Alisher Karimov', description: 'Admin to\'liq ismi' })
  @IsString()
  adminFullName: string;

  @ApiProperty({ example: 'testpro_admin', description: 'Admin login (unikal)' })
  @IsString()
  adminLogin: string;

  @ApiProperty({ example: '+998901234567', description: 'Admin telefon raqami' })
  @IsString()
  adminPhone: string;

  @ApiProperty({ example: 'secret123', description: 'Admin paroli (kamida 6 belgi)' })
  @IsString()
  @MinLength(6, { message: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak' })
  adminPassword: string;
}

