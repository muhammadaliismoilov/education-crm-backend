import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
  Req,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import {
  CreateBranchDto,
  UpdateBranchDto,
  CreateBranchWithAdminDto,
  UpdateBranchLocationDto,
  ToggleTeacherManualAttendanceDto,
} from './branches.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/guards/roles.decarator';
import { UserRole } from '../entities/user.entity';

// ─── Reusable examples ───────────────────────────────────────────────────────

const BRANCH_EXAMPLE = {
  id: 'b8e9b0e2-7649-416b-b2b9-e1ae9d9b02ae',
  name: 'Tashkent Branch',
  address: 'Chilonzor tumani, ...',
  phone: '+998901234567',
  subdomain: 'tashkent',
  customDomain: 'tashkent.crm.uz',
  isActive: true,
  createdAt: '2026-03-26T10:00:00.000Z',
  updatedAt: '2026-03-26T10:00:00.000Z',
  deletedAt: null,
};

const WRAP = (data: any, statusCode = 200) => ({
  data,
  statusCode,
  timestamp: '2026-03-26 10:00:00',
});

const NOT_FOUND = (msg = 'Filial topilmadi') => ({
  statusCode: 404,
  message: msg,
  error: 'Not Found',
});

// ─────────────────────────────────────────────────────────────────────────────

@ApiTags('Filiallar (Branches)')
// @ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @ApiOperation({
    summary: 'Yangi filial yaratish',
    description:
      'Yangi filial yaratiladi. Faqat Superadmin uchun ruxsat etilgan.',
  })
  @ApiResponse({
    status: 201,
    description: 'Filial muvaffaqiyatli yaratildi',
    schema: { example: WRAP(BRANCH_EXAMPLE, 201) },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request',
    schema: {
      example: {
        statusCode: 400,
        message: ['name should not be empty'],
        error: 'Bad Request',
      },
    },
  })
  create(@Body() createBranchDto: CreateBranchDto) {
    return this.branchesService.create(createBranchDto);
  }

  @Post('with-admin')
  @ApiOperation({
    summary: 'Yangi filial + Admin birga yaratish',
    description:
      'Filial va uning Admin foydalanuvchisi tranzaksiya ichida birga yaratiladi. ' +
      'Faqat Superadmin uchun ruxsat etilgan.',
  })
  @ApiResponse({
    status: 201,
    description: 'Filial va admin muvaffaqiyatli yaratildi',
    schema: {
      example: WRAP(
        {
          branch: BRANCH_EXAMPLE,
          admin: {
            id: 'uuid',
            fullName: 'Alisher Karimov',
            login: 'testpro_admin',
            role: 'admin',
          },
        },
        201,
      ),
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Login yoki subdomen allaqachon band',
    schema: {
      example: {
        statusCode: 409,
        message: '"testpro_admin" login allaqachon band',
        error: 'Conflict',
      },
    },
  })
  createWithAdmin(@Body() dto: CreateBranchWithAdminDto) {
    return this.branchesService.createWithAdmin(dto);
  }

  // ─── ADMIN — O'z filialining lokatsiyasini tahrirlash ─────────────────────
  @Patch('my-location')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: "O'z filiali lokatsiyasini tahrirlash (faqat Admin)",
    description:
      "Admin FAQAT o'z filialining latitude va longitude koordinatalarini " +
      "yangilashi mumkin. Boshqa ma'lumotlar (nom, telefon, subdomen va h.k.) " +
      "o'zgartirilmaydi. Branch ID JWT tokendan avtomatik olinadi.",
  })
  @ApiResponse({
    status: 200,
    description: 'Lokatsiya muvaffaqiyatli yangilandi',
    schema: {
      example: WRAP({
        ...BRANCH_EXAMPLE,
        latitude: 41.2995,
        longitude: 69.2401,
      }),
    },
  })
  @ApiResponse({
    status: 403,
    description: "Ruxsat yo'q — admin boshqa filialga biriktirilmagan",
    schema: {
      example: {
        statusCode: 403,
        message:
          'Sizga hech qaysi filial biriktirilmagan. Superadminga murojaat qiling.',
        error: 'Forbidden',
      },
    },
  })
  updateMyLocation(@Body() dto: UpdateBranchLocationDto, @Req() req: any) {
    return this.branchesService.updateLocation(dto, req.user);
  }

  // ─── ADMIN — O'qituvchining qo'lda davomat sozlamasini o'zgartirish ─────────
  @Patch('teacher-manual-attendance')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: "O'qituvchi qo'lda davomat sozlamasini o'zgartirish (faqat Admin)",
    description:
      "Admin o'z filiali uchun o'qituvchiga qo'lda davomat qilish huquqini " +
      "yoqadi yoki o'chiradi. " +
      "true → O'qituvchi qo'lda ham davomat qila oladi. " +
      "false → O'qituvchi faqat FaceID orqali davomat qila oladi.",
  })
  @ApiResponse({
    status: 200,
    description: 'Sozlama muvaffaqiyatli yangilandi',
    schema: {
      example: WRAP({
        ...BRANCH_EXAMPLE,
        allowTeacherManualAttendance: true,
      }),
    },
  })
  @ApiResponse({
    status: 403,
    description: "Ruxsat yo'q — admin filialga biriktirilmagan",
    schema: {
      example: {
        statusCode: 403,
        message:
          'Sizga hech qaysi filial biriktirilmagan. Superadminga murojaat qiling.',
        error: 'Forbidden',
      },
    },
  })
  toggleTeacherManualAttendance(
    @Body() dto: ToggleTeacherManualAttendanceDto,
    @Req() req: any,
  ) {
    return this.branchesService.toggleTeacherManualAttendance(dto, req.user);
  }

  // ─── TEACHER/MANAGER/ADMIN — O'qituvchining qo'lda davomat holatini olish ─────────
  @Get('teacher-manual-attendance/status')
  @Roles(
    UserRole.ADMIN,
    UserRole.TEACHER,
    UserRole.MANAGER,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({
    summary: "O'qituvchi qo'lda davomat qila olish holatini olish",
    description: 'Filialning allowTeacherManualAttendance holatini qaytaradi.',
  })
  @ApiResponse({
    status: 200,
    description: 'Holat muvaffaqiyatli olindi',
    schema: {
      example: WRAP({
        allowTeacherManualAttendance: true,
      }),
    },
  })
  getTeacherManualAttendanceStatus(@Req() req: any) {
    return this.branchesService.getTeacherManualAttendanceStatus(req.user);
  }

  @Get()
  @ApiOperation({
    summary: 'Barcha filiallarni olish',
    description: "Barcha filiallar ro'yxati qaytariladi.",
  })
  @ApiResponse({
    status: 200,
    description: "Filiallar ro'yxati",
    schema: { example: WRAP([BRANCH_EXAMPLE]) },
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  findAll(@Query('page') page: number = 1, @Query('limit') limit: number = 10) {
    return this.branchesService.findAll(page, limit);
  }

  @Roles(
    UserRole.SUPERADMIN,
    UserRole.ADMIN,
    UserRole.TEACHER,
    UserRole.MANAGER,
  )
  @Get(':id')
  @ApiOperation({
    summary: "Filial ma'lumotlarini olish",
    description:
      "ID bo'yicha filial to'liq ma'lumotlari qaytariladi. " +
      "Teacher faqat o'z filiallini ko'ra oladi (allowTeacherManualAttendance sozlamasini bilish uchun).",
  })
  @ApiParam({ name: 'id', description: 'Filial UUID si', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: "Filial to'liq ma'lumotlari",
    schema: { example: WRAP(BRANCH_EXAMPLE) },
  })
  @ApiResponse({
    status: 403,
    description: "Teacher o'z filialidan boshqa filialni ko'ra olmaydi",
    schema: {
      example: {
        statusCode: 403,
        message: "Siz faqat o'z filialingizni ko'ra olasiz",
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Filial topilmadi',
    schema: { example: NOT_FOUND() },
  })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    // Teacher va Manager faqat o'z filialini ko'ra oladi
    if (
      req.user?.role === UserRole.TEACHER ||
      req.user?.role === UserRole.MANAGER
    ) {
      if (req.user.branchId !== id) {
        throw new ForbiddenException(
          "Siz faqat o'z filialingizni ko'ra olasiz",
        );
      }
    }
    return this.branchesService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Filial sozlamalarini tahrirlash',
  })
  @ApiParam({ name: 'id', description: 'Filial UUID si', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Filial muvaffaqiyatli yangilandi',
    schema: { example: WRAP(BRANCH_EXAMPLE) },
  })
  @ApiResponse({
    status: 404,
    description: 'Filial topilmadi',
    schema: { example: NOT_FOUND() },
  })
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBranchDto: UpdateBranchDto,
    @Req() req: any,
  ) {
    return this.branchesService.update(id, updateBranchDto, req?.user);
  }

  @Delete(':id')
  @ApiOperation({
    summary: "Filialni arxivga o'tkazish (Soft-delete)",
    description: "Filial o'chirilmaydi, shunchaki arxivlanadi.",
  })
  @ApiParam({ name: 'id', description: 'Filial UUID si', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Filial muvaffaqiyatli arxivlandi',
    schema: {
      example: WRAP({ message: 'Filial muvaffaqiyatli arxivlandi' }),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Filial topilmadi',
    schema: { example: NOT_FOUND() },
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.branchesService.remove(id);
  }
}
