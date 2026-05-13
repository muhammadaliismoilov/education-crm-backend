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
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ContractTemplatesService } from './contract-templates.service';
import {
  CreateContractTemplateDto,
  UpdateContractTemplateDto,
} from './dto/contract-template.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiExtraModels,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/guards/roles.decarator';
import { UserRole } from '../entities/user.entity';
import { IAuthenticatedRequest } from '../common/interfaces/auth.interface';

// ─────────────────────────────────────────────
// Swagger uchun namuna ma'lumotlar
// ─────────────────────────────────────────────
const S_TEMPLATE = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  title: 'Standard Frontend Kursi Shartnomasi',
  content: {
    title: 'SHARTNOMA №{{contractNumber}}',
    body: "Ushbu shartnoma {{date}} sanasida {{branchName}} o'quv markazi (keyingi o'rinlarda \"Markaz\") va {{studentName}} (ota-onasi: {{parentName}}, telefon: {{studentPhone}}) (keyingi o'rinlarda \"Talaba\") o'rtasida tuzildi.\n\n1. Markaz Talabaga sifatli ta'lim berish majburiyatini oladi.\n2. Talaba belgilangan to'lovlarni o'z vaqtida amalga oshirishi shart.",
    footer:
      "Markaz vakili imzosi: ___________\nTalaba imzosi: ___________\nSana: {{date}}",
  },
  branch: {
    id: 'b1c2d3e4-f5a6-7890-abcd-ef1234567891',
    name: 'Yunusobod Filiali',
  },
  createdAt: '2025-04-01T10:00:00.000Z',
  updatedAt: '2025-04-10T08:30:00.000Z',
  deletedAt: null,
};

const S_DELETED = { message: "Shablon muvaffaqiyatli o'chirildi" };

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

@ApiTags('📄 Shartnoma Shablonlari')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contract-templates')
@ApiExtraModels(CreateContractTemplateDto, UpdateContractTemplateDto)
export class ContractTemplatesController {
  constructor(
    private readonly contractTemplatesService: ContractTemplatesService,
  ) {}

  // ───────────────────────────────
  // POST /contract-templates/create
  // ───────────────────────────────
  @Post('create')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: '🆕 Yangi shartnoma shabloni yaratish',
    description: `
**Kirish huquqi:** \`SUPERADMIN\`, \`ADMIN\`

Tizimga yangi shartnoma shabloni qo'shadi. Yaratilgan shablon keyinchalik
\`POST /contracts\` endpointida \`templateId\` orqali ishlatiladi va
talaba ma'lumotlari bilan avtomatik to'ldiriladi.

### Qo'llab-quvvatlanadigan Placeholder'lar
| Placeholder | Ma'nosi |
|---|---|
| \`{{studentName}}\` | Talabaning to'liq ismi |
| \`{{parentName}}\` | Ota-onasining ismi |
| \`{{studentPhone}}\` | Talaba telefon raqami |
| \`{{contractNumber}}\` | Shartnoma tartib raqami |
| \`{{date}}\` | Shartnoma sanasi (uz-UZ formatida) |
| \`{{branchName}}\` | Filial nomi |

### Eslatma
- \`content.title\` — PDF sarlavhasi sifatida ko'rsatiladi (\`<h1>\`)
- \`content.body\` — Asosiy matn (\`<div>\`)
- \`content.footer\` — Pastki qism, imzo joylashtirish uchun (\`<div>\`)
    `,
  })
  @ApiBody({
    type: CreateContractTemplateDto,
    examples: {
      minimal: {
        summary: 'Minimal — faqat majburiy fieldlar',
        value: {
          title: 'Asosiy Kurs Shartnomasi',
          content: {
            title: 'SHARTNOMA №{{contractNumber}}',
            body: "{{studentName}} bilan {{branchName}} o'rtasida tuzildi.",
          },
        },
      },
      full: {
        summary: "To'liq — barcha fieldlar",
        value: {
          title: 'Standard Frontend Kursi Shartnomasi',
          content: {
            title: 'SHARTNOMA №{{contractNumber}}',
            body: "Ushbu shartnoma {{date}} sanasida {{branchName}} va {{studentName}} o'rtasida tuzildi. Ota-ona: {{parentName}}. Tel: {{studentPhone}}.",
            footer:
              'Markaz vakili: ___________\nTalaba: ___________\nSana: {{date}}',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: '✅ Shablon muvaffaqiyatli yaratildi.',
    schema: { example: WRAP(S_TEMPLATE, 201) },
  })
  @ApiResponse({
    status: 400,
    description: "❌ Validatsiya xatosi — majburiy maydonlar to'ldirilmagan yoki format noto'g'ri.",
    schema: {
      example: ERR(
        ['content.title should not be empty', 'title should not be empty'],
        400,
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: '❌ Token mavjud emas yoki yaroqsiz.',
    schema: { example: ERR('Unauthorized', 401) },
  })
  @ApiResponse({
    status: 403,
    description: '❌ Faqat ADMIN yoki SUPERADMIN yaratishi mumkin.',
    schema: { example: ERR('Forbidden resource', 403) },
  })
  create(
    @Body() dto: CreateContractTemplateDto,
    @Req() req: IAuthenticatedRequest,
  ) {
    return this.contractTemplatesService.create(dto, req.user);
  }

  // ──────────────────────────────
  // GET /contract-templates
  // ──────────────────────────────
  @Get()
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: "📋 Barcha shablonlar ro'yxati",
    description: `
**Kirish huquqi:** \`SUPERADMIN\`, \`ADMIN\`, \`MANAGER\`

Foydalanuvchining fililiga tegishli barcha mavjud shablonlarni qaytaradi.
Natijalar \`createdAt\` bo'yicha kamayish tartibida (yangilar birinchi) saralanadi.

### Frontend uchun eslatma
- \`MANAGER\` faqat o'z filialidagi shablonlarni ko'radi
- Shablon ID sini keyinchalik \`POST /contracts\` da \`templateId\` sifatida ishlating
    `,
  })
  @ApiResponse({
    status: 200,
    description: "✅ Shablonlar ro'yxati muvaffaqiyatli qaytarildi.",
    schema: { example: WRAP([S_TEMPLATE]) },
  })
  @ApiResponse({
    status: 401,
    description: '❌ Token mavjud emas yoki yaroqsiz.',
    schema: { example: ERR('Unauthorized', 401) },
  })
  findAll(@Req() req: IAuthenticatedRequest) {
    return this.contractTemplatesService.findAll(req.user);
  }

  // ──────────────────────────────
  // GET /contract-templates/:id
  // ──────────────────────────────
  @Get(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: "🔍 Bitta shablonni ko'rish",
    description: `
**Kirish huquqi:** \`SUPERADMIN\`, \`ADMIN\`, \`MANAGER\`

UUID bo'yicha aniq bir shablonning to'liq ma'lumotlarini qaytaradi.
Boshqa filialga tegishli shablon so'ralsa \`404\` qaytariladi (xavfsizlik).
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Shablon UUID identifikatori',
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: "✅ Shablon ma'lumotlari.",
    schema: { example: WRAP(S_TEMPLATE) },
  })
  @ApiResponse({
    status: 400,
    description: "❌ Noto'g'ri UUID format.",
    schema: { example: ERR('Validation failed (uuid is expected)', 400) },
  })
  @ApiResponse({
    status: 404,
    description: '❌ Shablon topilmadi yoki bu filialga tegishli emas.',
    schema: { example: ERR('Shablon topilmadi', 404) },
  })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: IAuthenticatedRequest,
  ) {
    return this.contractTemplatesService.findOne(id, req.user);
  }

  // ──────────────────────────────
  // PATCH /contract-templates/:id
  // ──────────────────────────────
  @Patch(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: '✏️ Shablonni tahrirlash',
    description: `
**Kirish huquqi:** \`SUPERADMIN\`, \`ADMIN\`

Mavjud shablonning \`title\` yoki \`content\` maydoni (yoki ikkalasini) yangilaydi.
Faqat o'zgartirilishi kerak bo'lgan maydonlarni yuboring (partial update).

### Muhim
- Bu shablon orqali yaratilgan **mavjud shartnomalar o'zgarmaydi**
- Faqat kelajakda yaratilajak shartnomalar yangilangan shablonni ishlatadi
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Tahrir qilinadigan shablon UUID identifikatori',
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiBody({
    type: UpdateContractTemplateDto,
    examples: {
      title_only: {
        summary: 'Faqat nomni o\'zgartirish',
        value: { title: 'Standard Frontend Kursi Shartnomasi v2' },
      },
      content_only: {
        summary: 'Faqat matnni o\'zgartirish',
        value: {
          content: {
            title: 'YANGILANGAN SHARTNOMA №{{contractNumber}}',
            body: '{{studentName}} bilan yangilangan shartlar asosida...',
            footer: 'Imzo: ___________',
          },
        },
      },
      both: {
        summary: 'Ikkisini ham o\'zgartirish',
        value: {
          title: 'Yangi Nom',
          content: {
            title: 'SHARTNOMA №{{contractNumber}}',
            body: '{{studentName}} bilan...',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '✅ Shablon muvaffaqiyatli yangilandi.',
    schema: {
      example: WRAP({
        ...S_TEMPLATE,
        title: 'Standard Frontend Kursi Shartnomasi v2',
        updatedAt: new Date().toISOString(),
      }),
    },
  })
  @ApiResponse({
    status: 400,
    description: "❌ Validatsiya xatosi.",
    schema: {
      example: ERR('content.title must be a string', 400),
    },
  })
  @ApiResponse({
    status: 403,
    description: '❌ Faqat ADMIN yoki SUPERADMIN tahrirlay oladi.',
    schema: { example: ERR('Forbidden resource', 403) },
  })
  @ApiResponse({
    status: 404,
    description: '❌ Shablon topilmadi.',
    schema: { example: ERR('Shablon topilmadi', 404) },
  })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateContractTemplateDto,
    @Req() req: IAuthenticatedRequest,
  ) {
    return this.contractTemplatesService.update(id, dto, req.user);
  }

  // ──────────────────────────────
  // DELETE /contract-templates/:id
  // ──────────────────────────────
  @Delete(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: "🗑️ Shablonni o'chirish (Soft Delete)",
    description: `
**Kirish huquqi:** \`SUPERADMIN\`, \`ADMIN\`

Mavjud shablonni tizimdan o'chiradi. **Soft delete** — ma'lumot bazadan
butunlay o'chirilmaydi, \`deletedAt\` timestampi o'rnatiladi.

### Muhim
- O'chirilgach shablon ro'yxatdan ko'rinmaydi
- Bu shablon orqali ilgari yaratilgan **shartnomalar saqlanib qoladi**
- O'chirishni **bekor qilib bo'lmaydi** (hozircha restore endpoint yo'q)
    `,
  })
  @ApiParam({
    name: 'id',
    description: "O'chiriladigan shablon UUID identifikatori",
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: "✅ Shablon muvaffaqiyatli o'chirildi.",
    schema: { example: WRAP(S_DELETED) },
  })
  @ApiResponse({
    status: 403,
    description: "❌ Faqat ADMIN yoki SUPERADMIN o'chira oladi.",
    schema: { example: ERR('Forbidden resource', 403) },
  })
  @ApiResponse({
    status: 404,
    description: '❌ Shablon topilmadi.',
    schema: { example: ERR('Shablon topilmadi', 404) },
  })
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: IAuthenticatedRequest,
  ) {
    return this.contractTemplatesService.remove(id, req.user);
  }
}
