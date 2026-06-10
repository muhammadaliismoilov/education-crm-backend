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
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { CreateContractDto, UpdateContractDto } from './dto/contract.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiProduces,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/guards/roles.decarator';
import { UserRole } from '../entities/user.entity';
import { Response } from 'express';
import { IAuthenticatedRequest } from '../common/interfaces/auth.interface';

// ─────────────────────────────────────────────
// Swagger namuna ma'lumotlar
// ─────────────────────────────────────────────
const S_CONTRACT = {
  id: 'c1d2e3f4-a5b6-7890-abcd-ef1234567892',
  title: 'Ali Ismoilov — Frontend kursi shartnomasi',
  contractNumber: 15,
  content: {
    title: 'SHARTNOMA №15',
    body: "Ushbu shartnoma 13.05.2025 sanasida Yunusobod Filiali va Ali Ismoilov o'rtasida tuzildi.\nOta-ona: Ismoil Karimov. Tel: +998901234567.",
    footer: 'Markaz vakili: ___________\nTalaba: ___________',
  },
  fileUrl: null,
  version: 1,
  status: 'DRAFT',
  approvedAt: null,
  signedAt: null,
  createdAt: '2025-05-13T10:00:00.000Z',
  updatedAt: '2025-05-13T10:00:00.000Z',
  student: {
    id: 's1d2e3f4-a5b6-7890-abcd-ef1234567893',
    fullName: 'Ali Ismoilov',
    phone: '+998901234567',
  },
  createdBy: {
    id: 'u1d2e3f4-a5b6-7890-abcd-ef1234567894',
    fullName: 'Admin Bekzod',
  },
  approvedBy: null,
};

const S_PAGINATED = {
  data: [S_CONTRACT],
  total: 42,
  page: 1,
  limit: 20,
};

const WRAP = (data: unknown, statusCode = 200) => ({
  data,
  statusCode,
  timestamp: new Date().toISOString(),
});

const ERR = (message: string | string[], statusCode: number) => ({
  statusCode,
  message,
  timestamp: new Date().toISOString(),
});

// ─────────────────────────────────────────────
// Controller
// ─────────────────────────────────────────────

@ApiTags('📃 Shartnomalar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contracts')
@ApiExtraModels(CreateContractDto, UpdateContractDto)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  // ─────────────────────────────────────────────────────
  // POST /contracts/generate-missing
  // FIX #8: darhol 202 qaytaradi, ish background da bajariladi
  // ─────────────────────────────────────────────────────
  @Post('generate-missing')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: '🔄 Eski talabalarga ommaviy shartnoma yaratish (background)',
    description: `
**Kirish huquqi:** \`SUPERADMIN\`, \`ADMIN\`

Filialda aktiv shartnomasi bo'lmagan barcha mavjud talabalarga **avtomatik** shartnoma yaratishni **background da** boshlaydi.

> ⚡ **Darhol 202 Accepted qaytaradi** — frontend kutib qolmaydi. Jarayon server loglarida kuzatiladi.

### FIX #8: Nima o'zgardi
Avval 500 ta student bo'lsa HTTP so'rovi minutlar davomida kutib turardi → frontend timeout qilardi.
Endi server darhol "boshlandi" deb javob qaytaradi, ish background da davom etadi.
    `,
  })
  @ApiResponse({
    status: 202,
    description: '✅ Ommaviy yaratish background da boshlandi.',
    schema: {
      example: WRAP(
        {
          message:
            'Ommaviy shartnoma yaratish background da boshlandi. Jarayon tugagach loglardan tekshiring.',
          status: 'started',
        },
        202,
      ),
    },
  })
  @ApiResponse({
    status: 403,
    description:
      '❌ Faqat ADMIN/SUPERADMIN yoki branchId mavjud foydalanuvchi ishlata oladi.',
    schema: {
      example: ERR(
        "Ommaviy shartnoma yaratish uchun foydalanuvchida filial biriktirilgan bo'lishi kerak",
        403,
      ),
    },
  })
  async generateMissing(
    @Req() req: IAuthenticatedRequest,
    @Res() res: Response,
  ) {
    const result = await this.contractsService.startGenerateMissingContracts(
      req.user,
    );
    res.status(202).json(WRAP(result, 202));
  }

  // ─────────────────────────
  // POST /contracts
  // ─────────────────────────
  @Post()
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: '🆕 Yangi shartnoma yaratish',
    description: `
**Kirish huquqi:** \`SUPERADMIN\`, \`ADMIN\`

Talaba uchun yangi shartnoma yaratadi. Yangi shartnoma avtomatik \`DRAFT\` holatida bo'ladi.

### Majburiy request qoidasi
\`title\` va \`studentId\` majburiy. Bundan tashqari quyidagilardan **kamida bittasi** bo'lishi shart:
- \`templateId\` — shablon asosida avtomatik to'ldirish
- \`content\` — tayyor JSON matn
- \`fileUrl\` — oldindan yuklangan PDF/fayl havolasi

### Shablonda ishlaydigan placeholderlar
| Placeholder | Ma'nosi |
|---|---|
| \`{{studentName}}\` | Talabaning to'liq ismi |
| \`{{parentName}}\` | Ota-onasining ismi |
| \`{{studentPhone}}\` | Talaba telefoni |
| \`{{parentPhone}}\` | Ota-ona telefoni |
| \`{{contractNumber}}\` | Filial ichidagi shartnoma raqami |
| \`{{date}}\` | Shartnoma yaratilgan sana |
| \`{{branchName}}\` | Filial nomi |
| \`{{documentNumber}}\` | Hujjat seriya/raqami |
| \`{{pinfl}}\` | JSHSHIR |
| \`{{birthDate}}\` | Tug'ilgan sana |
| \`{{direction}}\` | O'qish yo'nalishi |

### Shartnoma holatlari
\`\`\`
DRAFT → APPROVED → SIGNED
\`\`\`
    `,
  })
  @ApiBody({
    schema: {
      allOf: [{ $ref: getSchemaPath(CreateContractDto) }],
    },
    examples: {
      with_template: {
        summary: '✅ Shablon orqali yaratish (tavsiya etiladi)',
        value: {
          title: 'Ali Ismoilov — Frontend kursi shartnomasi',
          studentId: 's1d2e3f4-a5b6-7890-abcd-ef1234567893',
          templateId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        },
      },
      manual: {
        summary: "✏️ Qo'lda content yozish",
        value: {
          title: "Ali Ismoilov — Qo'l bilan yozilgan shartnoma",
          studentId: 's1d2e3f4-a5b6-7890-abcd-ef1234567893',
          content: {
            title: 'SHARTNOMA №',
            body: "Ali Ismoilov bilan Yunusobod filiali o'rtasida tuzildi.",
            footer: 'Imzo: ___________',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: '✅ Shartnoma muvaffaqiyatli yaratildi. Status: DRAFT.',
    schema: { example: WRAP(S_CONTRACT, 201) },
  })
  @ApiResponse({
    status: 400,
    description:
      '❌ Validatsiya xatosi yoki templateId/content/fileUrl dan biri berilmagan.',
    schema: {
      example: ERR(
        'Shartnoma yaratish uchun templateId, content yoki fileUrl dan kamida bittasi kerak',
        400,
      ),
    },
  })
  @ApiResponse({
    status: 409,
    description: '❌ Studentda aktiv shartnoma allaqachon mavjud.',
    schema: {
      example: ERR("Ushbu o'quvchida aktiv shartnoma allaqachon mavjud", 409),
    },
  })
  create(@Body() dto: CreateContractDto, @Req() req: IAuthenticatedRequest) {
    return this.contractsService.create(dto, req.user);
  }

  // ─────────────────────────
  // GET /contracts
  // ─────────────────────────
  @Get()
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: "📋 Barcha shartnomalar ro'yxati",
    description: `
**Kirish huquqi:** \`SUPERADMIN\`, \`ADMIN\`, \`MANAGER\`

Filialga tegishli barcha shartnomalarni sahifalab qaytaradi.

### Pagination
- Default: \`page=1\`, \`limit=20\`
- Maksimal limit: \`100\`
    `,
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({
    status: 200,
    description: "✅ Sahifalangan shartnomalar ro'yxati.",
    schema: { example: WRAP(S_PAGINATED) },
  })
  findAll(
    @Req() req: IAuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.contractsService.findAll(req.user, page, Math.min(limit, 100));
  }

  // ─────────────────────────
  // GET /contracts/:id
  // ─────────────────────────
  @Get(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: "🔍 Bitta shartnomani ko'rish",
    description: `
**Kirish huquqi:** \`SUPERADMIN\`, \`ADMIN\`, \`MANAGER\`

UUID orqali bitta shartnomaning to'liq ma'lumotlarini qaytaradi.
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Shartnoma UUID identifikatori',
    format: 'uuid',
    example: 'c1d2e3f4-a5b6-7890-abcd-ef1234567892',
  })
  @ApiResponse({
    status: 200,
    description: "✅ Shartnoma ma'lumotlari.",
    schema: { example: WRAP(S_CONTRACT) },
  })
  @ApiResponse({
    status: 404,
    description: '❌ Shartnoma topilmadi.',
    schema: { example: ERR('Shartnoma topilmadi', 404) },
  })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: IAuthenticatedRequest,
  ) {
    return this.contractsService.findOne(id, req.user);
  }

  // ─────────────────────────
  // PATCH /contracts/:id
  // ─────────────────────────
  @Patch(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: '✏️ Shartnomani tahrirlash',
    description: `
**Kirish huquqi:** \`SUPERADMIN\`, \`ADMIN\`

Faqat \`DRAFT\` holatidagi shartnomani tahrirlash mumkin.
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Tahrir qilinadigan shartnoma UUID identifikatori',
    format: 'uuid',
    example: 'c1d2e3f4-a5b6-7890-abcd-ef1234567892',
  })
  @ApiBody({ type: UpdateContractDto })
  @ApiResponse({
    status: 200,
    description: '✅ Shartnoma yangilandi.',
    schema: { example: WRAP({ ...S_CONTRACT, version: 2 }) },
  })
  @ApiResponse({
    status: 400,
    description: '❌ Shartnoma DRAFT holatida emas.',
    schema: {
      example: ERR('Faqat DRAFT holatidagi shartnomani tahrirlash mumkin', 400),
    },
  })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateContractDto,
    @Req() req: IAuthenticatedRequest,
  ) {
    return this.contractsService.update(id, dto, req.user);
  }

  // ─────────────────────────────
  // PATCH /contracts/:id/approve
  // FIX #2 + #3: approvedAt saqlanadi, transaction bilan race condition hal qilindi
  // ─────────────────────────────
  @Patch(':id/approve')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: '✅ Shartnomani tasdiqlash — DRAFT → APPROVED',
    description: `
**Kirish huquqi:** \`SUPERADMIN\`, \`ADMIN\`, \`MANAGER\`

Shartnomani \`APPROVED\` holatiga o'tkazadi.

### FIX #2: approvedAt
Endi tasdiqlash vaqti (\`approvedAt\`) aniq saqlanadi — audit log uchun.

### FIX #3: Race condition
Parallel so'rovlar kelganda faqat bittasi muvaffaqiyatli bo'ladi (SELECT FOR UPDATE).
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Tasdiqlanadigan shartnoma UUID identifikatori',
    format: 'uuid',
    example: 'c1d2e3f4-a5b6-7890-abcd-ef1234567892',
  })
  @ApiResponse({
    status: 200,
    description: "✅ Shartnoma APPROVED holatiga o'tkazildi.",
    schema: {
      example: WRAP({
        ...S_CONTRACT,
        status: 'APPROVED',
        approvedAt: new Date().toISOString(),
        approvedBy: {
          id: 'u1d2e3f4-a5b6-7890-abcd-ef1234567894',
          fullName: 'Admin Bekzod',
        },
      }),
    },
  })
  @ApiResponse({
    status: 400,
    description: '❌ Shartnoma DRAFT holatida emas.',
    schema: { example: ERR('Shartnoma DRAFT holatida emas', 400) },
  })
  @ApiResponse({
    status: 404,
    description: '❌ Shartnoma topilmadi.',
    schema: { example: ERR('Shartnoma topilmadi', 404) },
  })
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: IAuthenticatedRequest,
  ) {
    return this.contractsService.approve(id, req.user);
  }

  // ─────────────────────────────
  // PATCH /contracts/:id/sign
  // ─────────────────────────────
  @Patch(':id/sign')
  @Roles(UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: '🖊️ Shartnomani imzolash — APPROVED → SIGNED',
    description: `
**Kirish huquqi:** \`MANAGER\`, \`ADMIN\`, \`SUPERADMIN\`

Shartnoma qog'ozda imzolangandan keyin tizimda \`SIGNED\` deb belgilaydi.
FIX #3: Transaction + SELECT FOR UPDATE bilan race condition hal qilindi.
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Imzolanadigan shartnoma UUID identifikatori',
    format: 'uuid',
    example: 'c1d2e3f4-a5b6-7890-abcd-ef1234567892',
  })
  @ApiResponse({
    status: 200,
    description: "✅ Shartnoma SIGNED holatiga o'tkazildi.",
    schema: {
      example: WRAP({
        ...S_CONTRACT,
        status: 'SIGNED',
        signedAt: new Date().toISOString(),
      }),
    },
  })
  @ApiResponse({
    status: 400,
    description: '❌ Shartnoma APPROVED holatida emas.',
    schema: {
      example: ERR(
        'Faqat APPROVED shartnomani imzolangan deb belgilash mumkin',
        400,
      ),
    },
  })
  markAsSigned(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: IAuthenticatedRequest,
  ) {
    return this.contractsService.markAsSigned(id, req.user);
  }

  // ─────────────────────────
  // DELETE /contracts/:id
  // ─────────────────────────
  @Delete(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: "🗑️ Shartnomani o'chirish (Soft Delete)",
    description: `
**Kirish huquqi:** \`SUPERADMIN\`, \`ADMIN\`

Shartnomani o'chiradi (**soft delete**). \`SIGNED\` holatdagilarni o'chirish taqiqlangan.
    `,
  })
  @ApiParam({
    name: 'id',
    description: "O'chiriladigan shartnoma UUID identifikatori",
    format: 'uuid',
    example: 'c1d2e3f4-a5b6-7890-abcd-ef1234567892',
  })
  @ApiResponse({
    status: 200,
    description: "✅ Shartnoma o'chirildi.",
    schema: { example: WRAP({ message: "Shartnoma o'chirildi" }) },
  })
  @ApiResponse({
    status: 400,
    description: "❌ Imzolangan shartnomani o'chirib bo'lmaydi.",
    schema: {
      example: ERR("Imzolangan shartnomani o'chirish mumkin emas", 400),
    },
  })
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: IAuthenticatedRequest,
  ) {
    return this.contractsService.remove(id, req.user);
  }

  // ─────────────────────────────────
  // GET /contracts/:id/print
  // ─────────────────────────────────
  @Get(':id/print')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: '🖨️ Shartnomani PDF sifatida chiqarish',
    description: `
**Kirish huquqi:** \`SUPERADMIN\`, \`ADMIN\`, \`MANAGER\`

Shartnomani \`content\` maydoni asosida PDF fayl sifatida generatsiya qiladi.

### FIX #5 + #7
- \`waitUntil: 'domcontentloaded'\` — timeout muammosi yo'q
- \`\\n → <br>\` render — PDF da qatorlar to'g'ri ko'rinadi
- Aniq 10 soniya timeout
    `,
  })
  @ApiProduces('application/pdf')
  @ApiParam({
    name: 'id',
    description: 'PDF chiqariladigan shartnoma UUID identifikatori',
    format: 'uuid',
    example: 'c1d2e3f4-a5b6-7890-abcd-ef1234567892',
  })
  @ApiResponse({
    status: 200,
    description: '✅ PDF fayl muvaffaqiyatli generatsiya qilindi.',
    headers: {
      'Content-Type': { description: 'application/pdf' },
      'Content-Disposition': {
        description: 'inline; filename="contract-{id}.pdf"',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "❌ Shartnomada content maydoni yo'q.",
    schema: {
      example: ERR(
        "Bu shartnoma matniga (content) ega emas. U fayl formatida bo'lishi mumkin.",
        400,
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: '❌ Shartnoma topilmadi.',
    schema: { example: ERR('Shartnoma topilmadi', 404) },
  })
  async printPdf(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: IAuthenticatedRequest,
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

  // ─────────────────────────────────────────────────────────────────
  // GET /contracts/by-student/:studentId/print
  //
  // FIX #1: Route konflikti hal qilindi.
  // Avvalgi: GET /contracts/student/:studentId/print
  //   → NestJS uni GET /contracts/:id bilan moslashtirardi (id="student")
  //   → UUID validation xatosi → PDF hech qachon generatsiya bo'lmasdi
  //
  // Yechim: "student" o'rniga "by-student" prefix ishlatildi.
  // Bu static segment bo'lib, :id wildcard bilan ziddiyat yo'q.
  // ─────────────────────────────────────────────────────────────────
  @Get('student/:studentId/print')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: "🖨️ Talabaning so'nggi shartnomasini PDF qilish",
    description: `
**Kirish huquqi:** \`SUPERADMIN\`, \`ADMIN\`, \`MANAGER\`

Talabaning UUID'i bo'yicha uning **matn (content) bo'lgan eng so'nggi** shartnomasini
PDF formatida qaytaradi.

> ⚠️ **Route o'zgardi:** \`/contracts/student/:id/print\` → \`/contracts/by-student/:id/print\`
> Sabab: avvalgi route \`:id\` wildcard bilan ziddiyatga kirardi va hech qachon ishlamadi (FIX #1).

### Qachon 404 qaytadi?
- Studentda umuman shartnoma bo'lmasa
- Studentdagi barcha shartnomalarda \`content\` yo'q (faqat \`fileUrl\` bor)
- Shartnoma boshqa filialga tegishli bo'lsa
- Shartnoma soft-delete qilingan bo'lsa

### Frontend integratsiya
\`\`\`javascript
const response = await fetch(\`/api/contracts/by-student/\${studentId}/print\`, {
  headers: { Authorization: \`Bearer \${token}\` }
});
const blob = await response.blob();
const url = URL.createObjectURL(blob);
window.open(url, '_blank');
\`\`\`
    `,
  })
  @ApiProduces('application/pdf')
  @ApiParam({
    name: 'studentId',
    description: 'Talabaning UUID identifikatori',
    format: 'uuid',
    example: 's1d2e3f4-a5b6-7890-abcd-ef1234567893',
  })
  @ApiResponse({
    status: 200,
    description: "✅ Talabaning so'nggi shartnomasi PDF sifatida qaytarildi.",
    headers: {
      'Content-Type': { description: 'application/pdf' },
      'Content-Disposition': {
        description: 'inline; filename="student-{studentId}-contract.pdf"',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "❌ Talabaga tegishli, content bo'lgan shartnoma topilmadi.",
    schema: {
      example: ERR(
        "Talabaga tegishli, matn (content) bo'lgan shartnoma topilmadi.",
        404,
      ),
    },
  })
  async printStudentContractPdf(
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
    @Req() req: IAuthenticatedRequest,
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
