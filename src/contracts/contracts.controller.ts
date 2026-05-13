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
    body: "Ushbu shartnoma 13.05.2025 sanasida Yunusobod Filiali va Ali Ismoilov o'rtasida tuzildi. Ota-ona: Ismoil Karimov. Tel: +998901234567.",
    footer: "Markaz vakili: ___________\nTalaba: ___________",
  },
  fileUrl: null,
  version: 1,
  status: 'DRAFT',
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

  // ─────────────────────────
  // POST /contracts
  // ─────────────────────────
  @Post()
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: '🆕 Yangi shartnoma yaratish',
    description: `
**Kirish huquqi:** \`SUPERADMIN\`, \`ADMIN\`

Talaba uchun yangi shartnoma yaratadi. Yangi shartnoma avtomatik \`DRAFT\` holatida bo'ladi.

### Ikki usul bilan yaratish mumkin:

**1. Shablon orqali** (\`templateId\` bering):
- \`templateId\` orqali shablonni topadi
- Placeholder larni (\`{{studentName}}\` va h.k.) talaba ma'lumotlari bilan avtomatik almashtiradi
- \`content\` maydonini berishga hojat yo'q

**2. To'g'ridan-to'g'ri** (\`content\` bering):
- \`templateId\` yo'q, \`content\` ni o'zingiz to'liq yozing
- Placeholder lar almashtirilmaydi

### Shartnoma holatlari (Status Machine)
\`\`\`
DRAFT → APPROVED → SIGNED
\`\`\`
| Holat | Kim o'tkaza oladi | Nima mumkin |
|---|---|---|
| \`DRAFT\` | Yaratilganda avtomatik | Tahrirlash, tasdiqlash, o'chirish |
| \`APPROVED\` | ADMIN, SUPERADMIN | PDF chiqarish, imzolash |
| \`SIGNED\` | MANAGER, ADMIN, SUPERADMIN | Faqat ko'rish, PDF |
    `,
  })
  @ApiBody({
    type: CreateContractDto,
    examples: {
      with_template: {
        summary: '✅ Shablon orqali yaratish (tavsiya etiladi)',
        description: 'templateId berilsa, content avtomatik to\'ldiriladi',
        value: {
          title: 'Ali Ismoilov — Frontend kursi shartnomasi',
          studentId: 's1d2e3f4-a5b6-7890-abcd-ef1234567893',
          templateId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        },
      },
      manual: {
        summary: '✏️ Qo\'lda content yozish',
        description: 'templateId yo\'q — content to\'liq berilishi shart',
        value: {
          title: 'Ali Ismoilov — Qo\'l bilan yozilgan shartnoma',
          studentId: 's1d2e3f4-a5b6-7890-abcd-ef1234567893',
          content: {
            title: 'SHARTNOMA №',
            body: "Ali Ismoilov bilan Yunusobod filiali o'rtasida tuzildi.",
            footer: 'Imzo: ___________',
          },
        },
      },
      with_file: {
        summary: '📎 Tayyor PDF fayl URL bilan',
        description: 'Tashqaridan yuklangan PDF fayl manzili',
        value: {
          title: 'Skanerlangan shartnoma',
          studentId: 's1d2e3f4-a5b6-7890-abcd-ef1234567893',
          fileUrl: 'https://storage.example.com/contracts/contract-123.pdf',
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
    description: "❌ Validatsiya xatosi.",
    schema: {
      example: ERR(
        ['studentId must be a UUID', 'title should not be empty'],
        400,
      ),
    },
  })
  @ApiResponse({
    status: 403,
    description: '❌ Faqat ADMIN yoki SUPERADMIN yarata oladi.',
    schema: { example: ERR('Forbidden resource', 403) },
  })
  @ApiResponse({
    status: 404,
    description: "❌ O'quvchi yoki shablon topilmadi.",
    schema: { example: ERR("O'quvchi topilmadi", 404) },
  })
  create(
    @Body() dto: CreateContractDto,
    @Req() req: IAuthenticatedRequest,
  ) {
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
Natijada \`student\`, \`createdBy\`, \`approvedBy\` relyatsiyalari ham keladi.

### Pagination
- Default: \`page=1\`, \`limit=20\`
- Maksimal limit: \`100\`
- Response da \`total\` — jami shartnomalar soni
    `,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Sahifa raqami (1 dan boshlanadi)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Bir sahifadagi natijalar soni (max: 100)',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: '✅ Sahifalangan shartnomalar ro\'yxati.',
    schema: { example: WRAP(S_PAGINATED) },
  })
  @ApiResponse({
    status: 401,
    description: '❌ Autentifikatsiya talab etiladi.',
    schema: { example: ERR('Unauthorized', 401) },
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
Boshqa filialga tegishli shartnoma so'ralsa \`404\` qaytariladi.
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
    description: '✅ Shartnoma ma\'lumotlari.',
    schema: { example: WRAP(S_CONTRACT) },
  })
  @ApiResponse({
    status: 400,
    description: "❌ Noto'g'ri UUID format.",
    schema: { example: ERR('Validation failed (uuid is expected)', 400) },
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
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: '✏️ Shartnomani tahrirlash',
    description: `
**Kirish huquqi:** \`SUPERADMIN\`, \`ADMIN\`

Shartnomaning \`title\`, \`content\` yoki \`fileUrl\` maydoni(larini) yangilaydi.

### Qoidalar
- ❗ Faqat \`DRAFT\` holatidagi shartnomani tahrirlash mumkin
- \`APPROVED\` yoki \`SIGNED\` bo'lsa → \`400\` xato
- Har muvaffaqiyatli tahrirlashda \`version\` 1 ga oshadi
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Tahrir qilinadigan shartnoma UUID identifikatori',
    format: 'uuid',
    example: 'c1d2e3f4-a5b6-7890-abcd-ef1234567892',
  })
  @ApiBody({
    type: UpdateContractDto,
    examples: {
      title_only: {
        summary: 'Faqat nomni o\'zgartirish',
        value: { title: 'Ali Ismoilov — Backend kursi shartnomasi' },
      },
      content_only: {
        summary: 'Matnni o\'zgartirish',
        value: {
          content: {
            title: 'YANGILANGAN SHARTNOMA №15',
            body: 'Yangilangan shartlar asosida...',
            footer: 'Imzo: ___________',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '✅ Shartnoma yangilandi. Version oshdi.',
    schema: { example: WRAP({ ...S_CONTRACT, version: 2 }) },
  })
  @ApiResponse({
    status: 400,
    description: "❌ Shartnoma DRAFT holatida emas yoki validatsiya xatosi.",
    schema: {
      example: ERR('Faqat DRAFT holatidagi shartnomani tahrirlash mumkin', 400),
    },
  })
  @ApiResponse({
    status: 404,
    description: '❌ Shartnoma topilmadi.',
    schema: { example: ERR('Shartnoma topilmadi', 404) },
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
  // ─────────────────────────────
  @Patch(':id/approve')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: '✅ Shartnomani tasdiqlash — DRAFT → APPROVED',
    description: `
**Kirish huquqi:** \`SUPERADMIN\`, \`ADMIN\`

Shartnomani \`APPROVED\` holatiga o'tkazadi.

### APPROVED holatida nima mumkin?
- ✅ PDF chiqarish (\`GET /contracts/:id/print\`)
- ✅ Imzolash (\`PATCH /contracts/:id/sign\`)
- ❌ Tahrirlash — mumkin emas
- ❌ Qayta DRAFT — mumkin emas

### Eslatma
- Response da \`approvedBy\` — admin ma'lumotlari bilan to'ldiriladi
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
        approvedBy: { id: 'u1d2e3f4-a5b6-7890-abcd-ef1234567894', fullName: 'Admin Bekzod' },
      }),
    },
  })
  @ApiResponse({
    status: 400,
    description: "❌ Shartnoma DRAFT holatida emas.",
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

### SIGNED holatida nima mumkin?
- ✅ PDF chiqarish
- ✅ Ko'rish
- ❌ Tahrirlash — mumkin emas
- ❌ O'chirish — **TAQIQLANGAN**

### Response
- \`signedAt\` — imzolangan sana-vaqt o'rnatiladi
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
    description: "❌ Shartnoma APPROVED holatida emas.",
    schema: {
      example: ERR('Faqat APPROVED shartnomani imzolangan deb belgilash mumkin', 400),
    },
  })
  @ApiResponse({
    status: 404,
    description: '❌ Shartnoma topilmadi.',
    schema: { example: ERR('Shartnoma topilmadi', 404) },
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

Shartnomani o'chiradi (**soft delete** — bazadan butunlay o'chirilmaydi).

### Qoida
- ❗ \`SIGNED\` holatidagi shartnomalarni **o'chirish taqiqlangan**
- \`DRAFT\` va \`APPROVED\` holatdagilarni o'chirish mumkin
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
    schema: { example: ERR("Imzolangan shartnomani o'chirish mumkin emas", 400) },
  })
  @ApiResponse({
    status: 403,
    description: "❌ Faqat ADMIN yoki SUPERADMIN o'chira oladi.",
    schema: { example: ERR('Forbidden resource', 403) },
  })
  @ApiResponse({
    status: 404,
    description: '❌ Shartnoma topilmadi.',
    schema: { example: ERR('Shartnoma topilmadi', 404) },
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

Shartnomani \`content\` maydoni asosida PDF fayl sifatida generatsiya qiladi
va brauzerga binary oqim (stream) sifatida qaytaradi.

### Frontend integratsiya

\`\`\`javascript
// Usul 1 — Brauzerda ochish
window.open(\`/api/contracts/\${contractId}/print\`, '_blank');

// Usul 2 — Yuklab olish (Blob)
const response = await fetch(\`/api/contracts/\${contractId}/print\`, {
  headers: { Authorization: \`Bearer \${token}\` }
});
const blob = await response.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = \`contract-\${contractId}.pdf\`;
a.click();
\`\`\`

### Response Headers
\`\`\`
Content-Type: application/pdf
Content-Disposition: inline; filename="contract-{id}.pdf"
\`\`\`

### Eslatma
- Faqat \`content\` maydoni bo'lgan shartnomalar uchun ishlaydi
- Faqat \`fileUrl\` bo'lib, \`content\` bo'lmasa → \`400\` xato
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

  // ─────────────────────────────────────────
  // GET /contracts/student/:studentId/print
  // ─────────────────────────────────────────
  @Get('student/:studentId/print')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: "🖨️ Talabaning so'nggi shartnomasini PDF qilish",
    description: `
**Kirish huquqi:** \`SUPERADMIN\`, \`ADMIN\`, \`MANAGER\`

Talabaning UUID'i bo'yicha uning **eng so'nggi yaratilgan** shartnomasini
PDF formatida qaytaradi. Shartnoma ID ni bilmasangiz — bu endpointdan foydalaning.

### Frontend integratsiya
\`\`\`javascript
// Talaba profilidan PDF chiqarish
const response = await fetch(\`/api/contracts/student/\${studentId}/print\`, {
  headers: { Authorization: \`Bearer \${token}\` }
});
const blob = await response.blob();
const url = URL.createObjectURL(blob);
window.open(url, '_blank');
\`\`\`

### Response Headers
\`\`\`
Content-Type: application/pdf
Content-Disposition: inline; filename="student-{studentId}-contract.pdf"
\`\`\`
    `,
  })
  @ApiProduces('application/pdf')
  @ApiParam({
    name: 'studentId',
    description: "Talabaning UUID identifikatori",
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
    description: "❌ Talabaga tegishli shartnoma topilmadi.",
    schema: { example: ERR('Talabaga tegishli shartnoma topilmadi.', 404) },
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
