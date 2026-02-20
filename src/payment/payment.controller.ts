import { Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../entities/user.entity';
import { Roles } from 'src/common/guards/roles.decarator';
import { CreatePaymentDto, UpdatePaymentDto } from './payment.dto';

@ApiTags('To‘lovlar (Payments)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  // @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Yangi to‘lov yaratish' })
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentService.create(dto);
  }

  @Get()
  // @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Barcha to‘lovlarni filtrlash va sahifalab olish' })
  @ApiQuery({ name: 'search', required: false, description: 'Talaba ismi bo‘yicha' })
  @ApiQuery({ name: 'page', required: false })
  findAll(@Query('search') search?: string, @Query('page') page?: number) {
    return this.paymentService.findAll(search, Number(page) || 1);
  }

  @Get(':id/receipt')
  @ApiOperation({ summary: 'To’lov cheki ma’lumotlarini olish' })
  async getReceipt(@Param('id') id: string) {
    return this.paymentService.getReceiptData(id);
  }

  @Get(':id')
  // @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Bitta to‘lov ma’lumotini olish' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentService.findOne(id);
  }

  @Patch(':id')
  // @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'To‘lovni tahrirlash' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePaymentDto) {
    return this.paymentService.update(id, dto);
  }

  @Delete(':id')
  // @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'To‘lovni o‘chirish' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentService.remove(id);
  }
}