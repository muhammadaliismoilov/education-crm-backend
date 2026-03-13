// payment.controller.ts
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../entities/user.entity';
import { Roles } from '../common/guards/roles.decarator';
import { CreatePaymentDto, UpdatePaymentDto } from './payment.dto';

@ApiTags("To'lovlar (Payments)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Yangi to'lov yaratish" })
  @ApiResponse({
    status: 201,
    description: "To'lov muvaffaqiyatli yaratildi",
    schema: {
      example: {
        data: {
          id: 'pay-uuid',
          amount: 800000,
          student: { id: 'uuid', fullName: 'Alisher Karimov' },
          createdAt: '2026-03-13T10:00:00.000Z',
        },
        statusCode: 201,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Talaba topilmadi' })
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Barcha to'lovlarni filtrlash va sahifalab olish" })
  @ApiQuery({
    name: 'search',
    required: false,
    description: "Talaba ismi bo'yicha",
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: {
          items: [
            {
              id: 'pay-uuid',
              amount: 800000,
              student: { fullName: 'Alisher Karimov' },
              createdAt: '2026-03-13T10:00:00.000Z',
            },
          ],
          meta: { totalItems: 50, totalPages: 5, currentPage: 1 },
        },
        statusCode: 200,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  findAll(@Query('search') search?: string, @Query('page') page?: number) {
    return this.paymentService.findAll(search, Number(page) || 1);
  }

  @Get(':id/receipt')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "To'lov cheki ma'lumotlarini olish" })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: {
          id: 'pay-uuid',
          amount: 800000,
          student: { fullName: 'Alisher Karimov', phone: '+998901234567' },
          createdAt: '2026-03-13T10:00:00.000Z',
        },
        statusCode: 200,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  @ApiResponse({ status: 404, description: "To'lov topilmadi" })
  async getReceipt(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentService.getReceiptData(id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Bitta to'lov ma'lumotini olish" })
  @ApiResponse({ status: 200, description: "To'lov ma'lumotlari" })
  @ApiResponse({ status: 404, description: "To'lov topilmadi" })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "To'lovni tahrirlash" })
  @ApiResponse({ status: 200, description: "To'lov muvaffaqiyatli yangilandi" })
  @ApiResponse({ status: 404, description: "To'lov topilmadi" })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentDto,
  ) {
    return this.paymentService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "To'lovni o'chirish (bekor qilish)" })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: { message: "To'lov bekor qilindi" },
        statusCode: 200,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  @ApiResponse({ status: 404, description: "To'lov topilmadi" })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentService.remove(id);
  }
}
