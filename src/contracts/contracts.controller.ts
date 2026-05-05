import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { CreateContractDto, UpdateContractDto } from './dto/contract.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/guards/roles.decarator';
import { UserRole } from '../entities/user.entity';
import { Response } from 'express';

const CONTRACT_EXAMPLE = {
  id: 'uuid-string',
  title: 'Backend kursi shartnomasi',
  contractNumber: 15,
  content: '<h1>Shartnoma</h1>...',
  fileUrl: null,
  version: 1,
  status: 'DRAFT',
  createdAt: '2025-04-01T10:00:00Z',
  updatedAt: '2025-04-01T10:00:00Z',
  student: { id: 'uuid', fullName: 'Ali Ismoilov' },
  createdBy: { id: 'uuid', fullName: 'Admin User' },
};

const WRAP = (data: any, statusCode = 200) => ({
  data,
  statusCode,
  timestamp: new Date().toISOString(),
});

@ApiTags('Shartnomalar (Contracts)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Yangi shartnoma yaratish',
    description:
      "Talaba uchun yangi shartnoma yaratadi. Agar 'templateId' berilsa, shartnoma matni avtomatik shakllanadi. " +
      "Yangi yaratilgan shartnoma 'DRAFT' holatida bo'ladi. Faqat Admin va Superadminlar yarata oladi.",
  })
  @ApiResponse({
    status: 201,
    description: 'Shartnoma muvaffaqiyatli yaratildi.',
    schema: { example: WRAP(CONTRACT_EXAMPLE, 201) },
  })
  @ApiResponse({ status: 400, description: "Noto'g'ri so'rov yoki ma'lumotlar." })
  @ApiResponse({ status: 403, description: 'Ruxsat etilmagan.' })
  @ApiResponse({
    status: 404,
    description: "O'quvchi yoki Shablon topilmadi.",
  })
  create(@Body() dto: CreateContractDto, @Req() req: any) {
    return this.contractsService.create(dto, req.user);
  }

  @Get()
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: "Barcha shartnomalarni ko'rish",
    description: "Filialga tegishli barcha shartnomalar ro'yxatini (o'quvchi ma'lumotlari bilan) qaytaradi.",
  })
  @ApiResponse({
    status: 200,
    description: "Shartnomalar ro'yxati.",
    schema: { example: WRAP([CONTRACT_EXAMPLE], 200) },
  })
  findAll(@Req() req: any) {
    return this.contractsService.findAll(req.user);
  }

  @Get(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ 
    summary: "Bitta shartnomani ko'rish",
    description: "ID orqali aniq bir shartnomaning barcha tafsilotlarini oladi." 
  })
  @ApiResponse({
    status: 200,
    description: "Shartnoma ma'lumotlari.",
    schema: { example: WRAP(CONTRACT_EXAMPLE, 200) },
  })
  @ApiResponse({ status: 404, description: 'Shartnoma topilmadi.' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.contractsService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Shartnomani tahrirlash',
    description:
      "Shartnoma nomi yoki matnini o'zgartiradi. DIQQAT: Faqat 'DRAFT' holatida tahrirlash mumkin. Tahrirlangandan so'ng versiya raqami oshadi.",
  })
  @ApiResponse({
    status: 200,
    description: 'Shartnoma muvaffaqiyatli tahrirlandi.',
    schema: { example: WRAP(CONTRACT_EXAMPLE, 200) },
  })
  @ApiResponse({
    status: 400,
    description: "Faqat 'DRAFT' holatida tahrirlash mumkin.",
  })
  @ApiResponse({ status: 404, description: 'Shartnoma topilmadi.' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContractDto,
    @Req() req: any,
  ) {
    return this.contractsService.update(id, dto, req.user);
  }

  @Patch(':id/approve')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Shartnomani tasdiqlash (DRAFT -> APPROVED)',
    description: "Shartnomani 'APPROVED' holatiga o'tkazadi. Tasdiqlangan shartnomani tahrirlab bo'lmaydi va uni Managerlar chop etishi mumkin bo'ladi.",
  })
  @ApiResponse({
    status: 200,
    description: "Shartnoma muvaffaqiyatli tasdiqlandi.",
    schema: { example: WRAP({ ...CONTRACT_EXAMPLE, status: 'APPROVED' }, 200) },
  })
  @ApiResponse({ status: 400, description: "Shartnoma 'DRAFT' holatida emas." })
  @ApiResponse({ status: 404, description: 'Shartnoma topilmadi.' })
  approve(@Param('id') id: string, @Req() req: any) {
    return this.contractsService.approve(id, req.user);
  }

  @Patch(':id/sign')
  @Roles(UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Shartnomani imzolandi deb belgilash (APPROVED -> SIGNED)',
    description:
      "Shartnoma qog'ozda imzolangandan so'ng, tizimda uni 'SIGNED' holatiga o'tkazish uchun foydalaniladi.",
  })
  @ApiResponse({
    status: 200,
    description: "Shartnoma imzolandi deb belgilandi.",
    schema: { example: WRAP({ ...CONTRACT_EXAMPLE, status: 'SIGNED' }, 200) },
  })
  @ApiResponse({ status: 400, description: "Shartnoma 'APPROVED' holatida emas." })
  @ApiResponse({ status: 404, description: 'Shartnoma topilmadi.' })
  markAsSigned(@Param('id') id: string, @Req() req: any) {
    return this.contractsService.markAsSigned(id, req.user);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: "Shartnomani o'chirish",
    description: "Shartnomani tizimdan o'chiradi. DIQQAT: 'SIGNED' (imzolangan) holatdagi shartnomalarni o'chirib bo'lmaydi.",
  })
  @ApiResponse({
    status: 200,
    description: "Shartnoma muvaffaqiyatli o'chirildi.",
    schema: { example: WRAP({ message: "Shartnoma o'chirildi" }, 200) },
  })
  @ApiResponse({
    status: 400,
    description: "Imzolangan shartnomani o'chirish ta'qiqlanadi.",
  })
  @ApiResponse({ status: 404, description: 'Shartnoma topilmadi.' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.contractsService.remove(id, req.user);
  }

  @Get(':id/print')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Shartnomani PDF formatida yuklab olish / chop etish',
    description: "Belgilangan ID'dagi shartnomani PDF formatida generatsiya qiladi va brauzerga PDF oqimi (stream) sifatida qaytaradi."
  })
  @ApiResponse({ status: 200, description: 'PDF fayl muvaffaqiyatli generatsiya qilindi.' })
  @ApiResponse({ status: 404, description: 'Shartnoma topilmadi.' })
  async printPdf(
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.contractsService.generatePdf(id, req.user);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="contract-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Get('student/:studentId/print')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: "Talabaning eng so'nggi shartnomasini PDF qilib chop etish",
    description: "O'quvchining barcha shartnomalari orasidan eng oxirgi (yangi) yaratilganini PDF formatida qaytaradi."
  })
  @ApiResponse({ status: 200, description: 'PDF fayl muvaffaqiyatli generatsiya qilindi.' })
  @ApiResponse({ status: 404, description: "O'quvchida shartnoma mavjud emas." })
  async printStudentContractPdf(
    @Param('studentId') studentId: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.contractsService.generatePdfByStudent(
      studentId,
      req.user,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="student-${studentId}-contract.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }
}
