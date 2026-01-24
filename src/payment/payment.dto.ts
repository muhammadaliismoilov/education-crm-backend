import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsUUID } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ example: 'studentid' })
  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({ example: 'groupid' })
  @IsUUID()
  @IsNotEmpty()
  groupId: string;

  @ApiProperty({ example: 500000 })
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ example: '2026-01-23' })
  @IsString()
  @IsNotEmpty()
  paymentDate: string; 
}