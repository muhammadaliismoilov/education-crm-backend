import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Patch,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../entities/user.entity';
import { Roles } from '../common/guards/roles.decarator';
import { CreateStudentDto, UpdateStudentDto } from './student.dto';
import { diskStorage } from 'multer';
import { extname } from 'path';

// ─── Reusable example lar ───────────────────────────────────────────────────

const STUDENT_EXAMPLE = {
  id: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
  fullName: 'Alisher Karimov',
  phone: '+998901234567',
  parentName: 'Karimov Baxtiyor',
  parentPhone: '+998901234568',
  documentType: 'passport',
  documentNumber: 'AB1234567',
  pinfl: '12345678901234',
  birthDate: '2000-01-15T00:00:00.000Z',
  direction: 'Backend',
  balance: 500000,
  photoUrl: '/uploads/students/student_1710000000000.jpg',
  faceDescriptor: null,
  enrolledGroups: [
    {
      id: 'bb096922-6249-4911-9a8c-9a503bb3e7d9',
      name: 'Node.js Backend',
      price: 800000,
      effectivePrice: 600000,
      hasDiscount: true,
    },
  ],
  discounts: [
    {
      id: 'discount-uuid',
      customPrice: 600000,
      group: {
        id: 'bb096922-6249-4911-9a8c-9a503bb3e7d9',
        name: 'Node.js Backend',
      },
    },
  ],
  payments: [],
  attendances: [],
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-03-13T10:00:00.000Z',
  deletedAt: null,
};

const WRAP = (data: any, statusCode = 200) => ({
  data,
  statusCode,
  timestamp: '2026-03-13 10:00:00',
});

const NOT_FOUND = {
  statusCode: 404,
  message: 'Talaba topilmadi',
  error: 'Not Found',
};

const CONFLICT = {
  statusCode: 409,
  message: "Bu telefon raqam allaqachon ro'yxatda bor",
  error: 'Conflict',
};

// ────────────────────────────────────────────────────────────────────────────

@ApiTags('Students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  // ─────────────────────────────────────────────
  // POST /students
  // ─────────────────────────────────────────────
  @Post()
  @Roles(UserRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: './uploads/students/',
        filename: (req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `temp_${unique}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return cb(
            new BadRequestException('Faqat rasm fayllari qabul qilinadi'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  @ApiOperation({
    summary: "Yangi talaba qo'shish",
    description:
      'Yangi talaba yaratadi. Rasm ixtiyoriy — JPG, PNG, WEBP, max 5MB. ' +
      "Bir nechta guruhga bir vaqtda qo'shish mumkin. " +
      'Rasm yuborilsa yuz avtomatik taniladi va faceDescriptor saqlanadi.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['fullName', 'phone', 'groupIds'],
      properties: {
        fullName: {
          type: 'string',
          example: 'Muxamadaliyev Ibroxim',
          description: "Talabaning to'liq ismi",
        },
        phone: {
          type: 'string',
          example: '+998900113000',
          description: 'Telefon raqami (+998XXXXXXXXX)',
          pattern: '^\\+998\\d{9}$',
        },
        parentName: {
          type: 'string',
          example: 'Karimov Baxtiyor',
          description: 'Ota-onasining ismi. Ixtiyoriy.',
        },
        parentPhone: {
          type: 'string',
          example: '+998901234567',
          description: 'Ota-onasining telefoni. Ixtiyoriy.',
          pattern: '^\\+998\\d{9}$',
        },
        documentType: {
          type: 'string',
          enum: ['passport', 'birth_certificate'],
          example: 'birth_certificate',
          description: 'Hujjat turi',
        },
        documentNumber: {
          type: 'string',
          example: 'AB1234567',
          description: 'Hujjat seriya va raqami',
        },
        pinfl: {
          type: 'string',
          example: '12345678901234',
          description: 'JSHSHIR — 14 xonali shaxsiy raqam',
          minLength: 14,
          maxLength: 14,
        },
        birthDate: {
          type: 'string',
          example: '2000-01-15',
          description: "Tug'ilgan sana (YYYY-MM-DD)",
        },
        direction: {
          type: 'string',
          example: 'Backend',
          description: "O'qish yo'nalishi. Ixtiyoriy.",
        },
        groupIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
          example: ['bb096922-6249-4911-9a8c-9a503bb3e7d9'],
          description: 'Guruhlar UUID lari. Kamida 1 ta.',
          minItems: 1,
        },
        photo: {
          type: 'string',
          format: 'binary',
          description: 'Rasm fayli. Ixtiyoriy. JPG, PNG, WEBP, max 5MB.',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Talaba muvaffaqiyatli yaratildi',
    schema: { example: WRAP(STUDENT_EXAMPLE, 201) },
  })
  @ApiResponse({
    status: 400,
    description: 'Validatsiya xatosi yoki rasmda yuz topilmadi',
    schema: {
      example: {
        statusCode: 400,
        message:
          "Rasmda yuz topilmadi! Aniqroq, yorug' rasmda yuzingiz ko'rinib tursin.",
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Guruh topilmadi',
    schema: {
      example: {
        statusCode: 404,
        message: 'Bir yoki bir nechta tanlangan guruhlar topilmadi',
        error: 'Not Found',
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Telefon, PINFL yoki hujjat raqami allaqachon mavjud',
    schema: { example: CONFLICT },
  })
  async create(
    @Body() dto: CreateStudentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.studentsService.create(dto, file);
  }

  // ─────────────────────────────────────────────
  // GET /students
  // ─────────────────────────────────────────────
  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: "Barcha talabalar ro'yxati",
    description:
      "Ism, telefon yoki guruh nomi bo'yicha qidirish va sahifalash.",
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: "Ism yoki telefon bo'yicha qidiruv",
  })
  @ApiQuery({
    name: 'groupName',
    required: false,
    description: "Guruh nomi bo'yicha filter",
  })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
    description: 'Sahifa raqami',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 10,
    description: 'Sahifadagi yozuvlar soni',
  })
  @ApiResponse({
    status: 200,
    description: "Talabalar ro'yxati",
    schema: {
      example: WRAP({
        items: [
          {
            ...STUDENT_EXAMPLE,
            payments: undefined,
            attendances: undefined,
          },
        ],
        meta: { totalItems: 87, totalPages: 9, currentPage: 1 },
      }),
    },
  })
  async findAll(
    @Query('search') search?: string,
    @Query('groupName') groupName?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) {
    return this.studentsService.findAll(search, groupName, page, limit);
  }

  // ─────────────────────────────────────────────
  // GET /students/deleted
  // ─────────────────────────────────────────────
  @Get('deleted')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "O'chirilgan (arxivlangan) talabalar",
    description:
      "Soft-delete qilingan talabalar ro'yxati. /:id/restore orqali qaytarish mumkin.",
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: "Ism, telefon yoki PINFL bo'yicha qidiruv",
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({
    status: 200,
    description: "Arxivlangan talabalar ro'yxati",
    schema: {
      example: WRAP({
        items: [
          {
            id: 'uuid',
            fullName: 'Zulfiya Rahimova',
            phone: '+998909876543',
            direction: 'Frontend',
            balance: -200000,
            photoUrl: null,
            enrolledGroups: [],
            createdAt: '2026-01-01T10:00:00.000Z',
            deletedAt: '2026-02-01T10:00:00.000Z',
          },
        ],
        meta: {
          totalItems: 3,
          totalPages: 1,
          currentPage: 1,
          itemsPerPage: 10,
        },
      }),
    },
  })
  async findAllDeleted(
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) {
    return this.studentsService.findAllDeleted(search, page, limit);
  }

  // ─────────────────────────────────────────────
  // GET /students/:id
  // ─────────────────────────────────────────────
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: "Bitta talaba to'liq ma'lumotlari",
    description:
      "ID bo'yicha talabaning to'liq ma'lumotlari: guruhlar (effectivePrice bilan), " +
      "to'lovlar, davomat, imtiyozlar.",
  })
  @ApiParam({ name: 'id', description: 'Talaba UUID si', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: "Talaba ma'lumotlari",
    schema: { example: WRAP(STUDENT_EXAMPLE) },
  })
  @ApiResponse({
    status: 404,
    description: 'Talaba topilmadi',
    schema: { example: NOT_FOUND },
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.findOne(id);
  }

  // ─────────────────────────────────────────────
  // PATCH /students/:id
  // ─────────────────────────────────────────────
    @Patch(':id')
    @Roles(UserRole.ADMIN)
    @ApiOperation({
      summary: "Talaba ma'lumotlarini yangilash",
      description:
        'Istalgan fieldni yangilash mumkin. Rasm ixtiyoriy — yangi rasm yuborilsa ' +
        "eski o'chiriladi va yuz descriptor yangilanadi. " +
        'discounts da null yuborilsa imtiyoz bekor qilinadi.',
    })
    @ApiParam({ name: 'id', description: 'Talaba UUID si', format: 'uuid' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
      schema: {
        type: 'object',
        properties: {
          fullName: { type: 'string', example: 'Ali Valiyev' },
          phone: {
            type: 'string',
            example: '+998901234567',
            pattern: '^\\+998\\d{9}$',
          },
          parentName: { type: 'string', example: 'Valiyev Hamid' },
          parentPhone: { type: 'string', example: '+998901234568' },
          birthDate: {
            type: 'string',
            example: '2000-01-15',
            description: 'YYYY-MM-DD',
          },
          direction: { type: 'string', example: 'Frontend' },
          documentType: {
            type: 'string',
            enum: ['passport', 'birth_certificate'],
            example: 'passport',
          },
          documentNumber: { type: 'string', example: 'AB1234567' },
          pinfl: {
            type: 'string',
            example: '12345678901234',
            minLength: 14,
            maxLength: 14,
          },
          groupIds: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
            example: ['bb096922-6249-4911-9a8c-9a503bb3e7d9'],
            minItems: 1,
          },
          discounts: {
            type: 'array',
            description:
              "Imtiyozli narxlar. customPrice=null bo'lsa imtiyoz bekor qilinadi.",
            items: {
              type: 'object',
              properties: {
                groupId: {
                  type: 'string',
                  format: 'uuid',
                  example: 'bb096922-6249-4911-9a8c-9a503bb3e7d9',
                },
                customPrice: {
                  type: 'number',
                  example: 600000,
                  nullable: true,
                  description: 'null = imtiyozni bekor qilish',
                },
              },
            },
          },
          photo: {
            type: 'string',
            format: 'binary',
            description: 'Ixtiyoriy. JPG, PNG, WEBP, max 5MB.',
          },
        },
      },
    })
    @UseInterceptors(
      FileInterceptor('photo', {
        storage: diskStorage({
          destination: './uploads/students/',
          filename: (req, file, cb) => {
            const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, `temp_${unique}${extname(file.originalname)}`);
          },
        }),
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
          if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
            return cb(
              new BadRequestException('Faqat JPG, PNG, WEBP formatidagi rasmlar'),
              false,
            );
          }
          cb(null, true);
        },
      }),
    )
    @ApiResponse({
      status: 200,
      description: 'Talaba muvaffaqiyatli yangilandi',
      schema: { example: WRAP(STUDENT_EXAMPLE) },
    })
    @ApiResponse({
      status: 400,
      description: 'Validatsiya xatosi, rasmda yuz topilmadi yoki imtiyoz xatosi',
      schema: {
        example: {
          statusCode: 400,
          message: "Imtiyozli narx 800000 so'mdan kichik bo'lishi kerak",
          error: 'Bad Request',
        },
      },
    })
    @ApiResponse({
      status: 404,
      description: 'Talaba yoki guruh topilmadi',
      schema: { example: NOT_FOUND },
    })
    @ApiResponse({
      status: 409,
      description: 'Telefon, PINFL yoki hujjat raqami band',
      schema: { example: CONFLICT },
    })
    async update(
      @Param('id', ParseUUIDPipe) id: string,
      @Body() dto: UpdateStudentDto,
      @UploadedFile() file?: Express.Multer.File,
    ) {
      return this.studentsService.update(id, dto, file);
    }

  // ─────────────────────────────────────────────
  // DELETE /students/:id
  // ─────────────────────────────────────────────
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Talabani arxivlash (soft delete)',
    description:
      "Talaba o'chirilmaydi, arxivlanadi. /:id/restore orqali qaytariladi.",
  })
  @ApiParam({ name: 'id', description: 'Talaba UUID si', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Talaba muvaffaqiyatli arxivlandi',
    schema: {
      example: WRAP({
        success: true,
        message: "O'quvchi muvaffaqiyatli arxivlandi",
      }),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Talaba topilmadi',
    schema: { example: NOT_FOUND },
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.remove(id);
  }

  // ─────────────────────────────────────────────
  // PATCH /students/:id/restore
  // ─────────────────────────────────────────────
  @Patch(':id/restore')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Arxivlangan talabani tiklash',
    description: 'Soft-delete qilingan talabani faol holatga qaytaradi.',
  })
  @ApiParam({ name: 'id', description: 'Talaba UUID si', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Talaba muvaffaqiyatli tiklandi',
    schema: {
      example: WRAP({
        ...STUDENT_EXAMPLE,
        deletedAt: null,
      }),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Talaba topilmadi',
    schema: { example: NOT_FOUND },
  })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.restore(id);
  }
}
