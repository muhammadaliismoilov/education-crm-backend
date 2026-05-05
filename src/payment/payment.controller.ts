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
  Req,
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
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: "Yangi to'lov yaratish",
    description:
      "Ushbu API orqali talaba uchun ma'lum bir guruhga to'lov qabul qilinadi. " +
      "To'lov yaratilganda talabaning balansi avtomatik qayta hisoblanadi. " +
      "Agar talabada imtiyoz bo'lsa, kurs narxi avtomatik ravishda shu imtiyozli narx bilan hisoblanadi. " +
      "Faqat Admin, Superadmin va Managerlar uchun ruxsat berilgan.",
  })
  @ApiResponse({
    status: 201,
    description: "To'lov muvaffaqiyatli yaratildi. Javobda to'lov haqida barcha hisob-kitoblar qaytariladi.",
    schema: {
      example: WRAP(
        {
          ...PAYMENT_EXAMPLE,
          coverageMonths: 1,
        },
        201,
      ),
    },
  })
  @ApiResponse({
    status: 400,
    description: "Noto'g'ri so'rov. Talaba guruhga a'zo emas yoki guruh narxi belgilanmagan.",
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
    description: "Topilmadi. Talaba yoki guruh mavjud emas.",
    schema: {
      example: {
        statusCode: 404,
        message: 'Talaba topilmadi',
        error: 'Not Found',
      },
    },
  })
  create(@Body() dto: CreatePaymentDto, @Req() req: any) {
    return this.paymentService.create(dto, req.user);
  }

  // ─────────────────────────────────────────────
  // GET /payments
  // ─────────────────────────────────────────────
  @Get()
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: "To'lovlarni filtrlash va ro'yxatini olish",
    description: "Barcha to'lovlarni sahifalab va turli parametrlar bo'yicha filtrlash imkonini beradi.",
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: "Talabaning ismi yoki familiyasi bo'yicha qidirish uchun foydalaniladi.",
    example: 'Alisher',
  })
  @ApiQuery({ 
    name: 'page', 
    required: false, 
    example: 1,
    description: "Sahifa raqami (default: 1)" 
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    example: 10,
    description: "Bir sahifadagi elementlar soni (default: 10)" 
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    description: "Filial bo'yicha filtrlash. FAQAT Superadmin uchun ishlaydi.",
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: "To'lovlar ro'yxati muvaffaqiyatli qaytarildi.",
    schema: {
      example: WRAP({
        data: [PAYMENT_EXAMPLE],
        meta: {
          totalItems: 50,
          totalPages: 5,
          currentPage: 1,
          itemsPerPage: 10,
        },
      }),
    },
  })
  findAll(
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Req() req?: any,
    @Query('branchId') branchId?: string,
  ) {
    return this.paymentService.findAll(
      search,
      Number(page) || 1,
      Number(limit) || 10,
      req.user,
      branchId,
    );
  }

  // ─────────────────────────────────────────────
  // GET /payments/:id/receipt
  // ─────────────────────────────────────────────
  @Get(':id/receipt')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: "To'lov cheki uchun ma'lumotlarni olish",
    description:
      "Ushbu endpoint to'lovdan so'ng chekni chop etish uchun kerak bo'ladigan barcha batafsil ma'lumotlarni (talaba, guruh narxi, to'lov holati va h.k.) qaytaradi.",
  })
  @ApiParam({ 
    name: 'id', 
    description: "Ma'lumotlari olinishi kerak bo'lgan to'lovning UUID identifikatori.", 
    format: 'uuid',
    example: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8'
  })
  @ApiResponse({
    status: 200,
    description: "Chek uchun barcha kerakli ma'lumotlar.",
    schema: {
      example: WRAP({
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
    description: "To'lov topilmadi.",
    schema: { example: NOT_FOUND },
  })
  async getReceipt(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.paymentService.getReceiptData(id, req.user);
  }

  // ─────────────────────────────────────────────
  // GET /payments/:id
  // ─────────────────────────────────────────────
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: "Bitta to'lov ma'lumotini olish",
    description: "ID orqali to'lov haqida barcha ma'lumotlarni (talaba va guruh bilan birga) oladi.",
  })
  @ApiParam({ 
    name: 'id', 
    description: "Olinadigan to'lovning UUID identifikatori.", 
    format: 'uuid',
    example: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8'
  })
  @ApiResponse({
    status: 200,
    description: "To'lov ma'lumotlari muvaffaqiyatli topildi.",
    schema: {
      example: WRAP(PAYMENT_EXAMPLE),
    },
  })
  @ApiResponse({
    status: 404,
    description: "To'lov topilmadi.",
    schema: { example: NOT_FOUND },
  })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.paymentService.findOne(id, req.user);
  }

  // ─────────────────────────────────────────────
  // PATCH /payments/:id
  // ─────────────────────────────────────────────
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: "To'lovni tahrirlash",
    description:
      "To'lovning summa miqdori yoki sanasini o'zgartirish uchun foydalaniladi. " +
      "Agar summa o'zgarsa, talabaning umumiy balansi ham avtomatik qayta hisoblanadi.",
  })
  @ApiParam({ 
    name: 'id', 
    description: "Tahrirlanadigan to'lovning UUID identifikatori.", 
    format: 'uuid',
    example: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8'
  })
  @ApiResponse({
    status: 200,
    description: "To'lov muvaffaqiyatli yangilandi.",
    schema: { example: WRAP(PAYMENT_EXAMPLE) },
  })
  @ApiResponse({
    status: 404,
    description: "To'lov topilmadi.",
    schema: { example: NOT_FOUND },
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentDto,
    @Req() req: any,
  ) {
    return this.paymentService.update(id, dto, req.user);
  }

  // ─────────────────────────────────────────────
  // DELETE /payments/:id
  // ─────────────────────────────────────────────
  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: "To'lovni o'chirish (bekor qilish)",
    description:
      "Xato kiritilgan yoki bekor qilingan to'lovni o'chirish. " +
      "O'chirilgandan so'ng talabaning balansi avtomatik ravishda to'lovdan oldingi holatiga qaytariladi.",
  })
  @ApiParam({ 
    name: 'id', 
    description: "O'chiriladigan to'lovning UUID identifikatori.", 
    format: 'uuid',
    example: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8'
  })
  @ApiResponse({
    status: 200,
    description: "To'lov muvaffaqiyatli o'chirildi va balanslar yangilandi.",
    schema: {
      example: WRAP({
        success: true,
        message: "To'lov o'chirildi va balans to'g'rilandi",
      }),
    },
  })
  @ApiResponse({
    status: 404,
    description: "To'lov topilmadi.",
    schema: { example: NOT_FOUND },
  })
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.paymentService.remove(id, req.user);
  }
}
