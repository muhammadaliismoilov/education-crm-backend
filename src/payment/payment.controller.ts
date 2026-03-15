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
  ApiParam,
} from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../entities/user.entity';
import { Roles } from '../common/guards/roles.decarator';
import { CreatePaymentDto, UpdatePaymentDto } from './payment.dto';

// ─── Reusable examples ───────────────────────────────────────────────────────

const PAYMENT_EXAMPLE = {
  id: 'pay-f6ed8de6-uuid',
  amount: 800000,
  paymentDate: '2026-03-13',
  debt: 0,
  advanceBalance: 0,
  student: {
    id: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
    fullName: 'Alisher Karimov',
    phone: '+998901234567',
    balance: 0,
  },
  group: {
    id: 'bb096922-6249-4911-9a8c-9a503bb3e7d9',
    name: 'Node.js Backend',
    price: 800000,
  },
  // formatPayment qo'shadigan fieldlar:
  coursePrice: 600000,
  paidAmount: 800000,
  isFullyPaid: true,
  hasDiscount: true,
  createdAt: '2026-03-13T10:00:00.000Z',
  updatedAt: '2026-03-13T10:00:00.000Z',
};

const WRAP = (data: any, statusCode = 200) => ({
  data,
  statusCode,
  timestamp: '2026-03-13 10:00:00',
});

const NOT_FOUND = {
  statusCode: 404,
  message: "To'lov topilmadi",
  error: 'Not Found',
};

// ─────────────────────────────────────────────────────────────────────────────

@ApiTags("To'lovlar (Payments)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // ─────────────────────────────────────────────
  // POST /payments
  // ─────────────────────────────────────────────
  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Yangi to'lov yaratish",
    description:
      "To'lov yaratilganda talabaning balansi avtomatik qayta hisoblanadi. " +
      "Imtiyozli narx mavjud bo'lsa coursePrice shu narxdan hisoblanadi.",
  })
  @ApiResponse({
    status: 201,
    description: "To'lov muvaffaqiyatli yaratildi",
    schema: {
      example: WRAP(
        {
          // TUZATISH: service { ...saved, debt, advanceBalance, coverageMonths,
          // coursePrice, paidAmount, isFullyPaid, hasDiscount } qaytaradi
          ...PAYMENT_EXAMPLE,
          coverageMonths: 1,
        },
        201,
      ),
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Talaba guruhga yozilmagan yoki narx belgilanmagan',
    schema: {
      example: {
        statusCode: 400,
        message: 'Talaba bu guruhga yozilmagan',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Talaba topilmadi',
    schema: {
      example: {
        statusCode: 404,
        message: 'Talaba topilmadi',
        error: 'Not Found',
      },
    },
  })
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentService.create(dto);
  }

  // ─────────────────────────────────────────────
  // GET /payments
  // ─────────────────────────────────────────────
  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Barcha to'lovlarni filtrlash va sahifalab olish",
    description: "Talaba ismi bo'yicha qidiruv va sahifalash imkoniyati.",
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: "Talaba ismi bo'yicha qidiruv",
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiResponse({
    status: 200,
    description: "To'lovlar ro'yxati",
    schema: {
      example: WRAP({
        // TUZATISH: service { items, meta } qaytaradi — items da
        // coursePrice, paidAmount, isFullyPaid, hasDiscount bor
        items: [PAYMENT_EXAMPLE],
        meta: { totalItems: 50, totalPages: 5, currentPage: 1 },
      }),
    },
  })
  findAll(@Query('search') search?: string, @Query('page') page?: number) {
    return this.paymentService.findAll(search, Number(page) || 1);
  }

  // ─────────────────────────────────────────────
  // GET /payments/:id/receipt
  // ─────────────────────────────────────────────
  @Get(':id/receipt')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "To'lov cheki ma'lumotlarini olish",
    description:
      "Chek uchun kerakli barcha ma'lumotlar: talaba, guruh, to'lov holati.",
  })
  @ApiParam({ name: 'id', description: "To'lov UUID si", format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: "Chek ma'lumotlari",
    schema: {
      example: WRAP({
        // TUZATISH: service { receiptNumber, date, student, group, payment, centerName }
        // qaytaradi — avvalgi example to'liq xato edi
        receiptNumber: 'PAY-F6ED',
        date: '2026-03-13 10:00:00',
        student: {
          fullName: 'Alisher Karimov',
          phone: '+998901234567',
          currentBalance: 0,
        },
        group: {
          name: 'Node.js Backend',
          originalPrice: 800000,
          price: 600000,
          hasDiscount: true,
        },
        payment: {
          amount: 600000,
          totalPaid: 600000,
          debt: 0,
          overpayment: 0,
          isFullyPaid: true,
        },
        centerName: 'Ali Edu CRM Center',
      }),
    },
  })
  @ApiResponse({
    status: 404,
    description: "To'lov topilmadi",
    schema: { example: NOT_FOUND },
  })
  async getReceipt(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentService.getReceiptData(id);
  }

  // ─────────────────────────────────────────────
  // GET /payments/:id
  // ─────────────────────────────────────────────
  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Bitta to'lov ma'lumotini olish",
    description: 'student va group relation bilan birga qaytariladi.',
  })
  @ApiParam({ name: 'id', description: "To'lov UUID si", format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: "To'lov ma'lumotlari",
    schema: {
      example: WRAP(PAYMENT_EXAMPLE),
    },
  })
  @ApiResponse({
    status: 404,
    description: "To'lov topilmadi",
    schema: { example: NOT_FOUND },
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentService.findOne(id);
  }

  // ─────────────────────────────────────────────
  // PATCH /payments/:id
  // ─────────────────────────────────────────────
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "To'lovni tahrirlash",
    description:
      'amount yoki paymentDate ni yangilash mumkin. ' +
      "amount o'zgarsa talabaning balansi avtomatik qayta hisoblanadi.",
  })
  @ApiParam({ name: 'id', description: "To'lov UUID si", format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: "To'lov muvaffaqiyatli yangilandi",
    // TUZATISH: update findOne qaytaradi —
    // { ...payment, coursePrice, paidAmount, isFullyPaid, debt, hasDiscount }
    schema: { example: WRAP(PAYMENT_EXAMPLE) },
  })
  @ApiResponse({
    status: 404,
    description: "To'lov topilmadi",
    schema: { example: NOT_FOUND },
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentDto,
  ) {
    return this.paymentService.update(id, dto);
  }

  // ─────────────────────────────────────────────
  // DELETE /payments/:id
  // ─────────────────────────────────────────────
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "To'lovni o'chirish (bekor qilish)",
    description:
      "To'lov o'chirilgandan so'ng talabaning balansi avtomatik qayta hisoblanadi.",
  })
  @ApiParam({ name: 'id', description: "To'lov UUID si", format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: "To'lov muvaffaqiyatli o'chirildi",
    schema: {
      example: WRAP({
        // TUZATISH: service { success: true, message: "To'lov o'chirildi va balans to'g'rilandi" }
        // qaytaradi — avvalgi { message: "To'lov bekor qilindi" } xato edi
        success: true,
        message: "To'lov o'chirildi va balans to'g'rilandi",
      }),
    },
  })
  @ApiResponse({
    status: 404,
    description: "To'lov topilmadi",
    schema: { example: NOT_FOUND },
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentService.remove(id);
  }
}
