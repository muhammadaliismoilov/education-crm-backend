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
      "Yangi talaba yaratadi. Rasm ixtiyoriy — JPG, PNG, WEBP, max 5MB. Bir nechta guruhga bir vaqtda qo'shish mumkin.",
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['fullName', 'phone', 'groupIds'],
      properties: {
        fullName: { type: 'string', example: 'Muxamadaliyev Ibroxim' },
        phone: { type: 'string', example: '+998900113000' },
        parentName: { type: 'string', example: 'Karimov Baxtiyor' },
        parentPhone: { type: 'string', example: '+998901234567' },
        documentType: {
          type: 'string',
          enum: ['passport', 'birth_certificate'],
        },
        documentNumber: { type: 'string', example: 'AB1234567' },
        pinfl: { type: 'string', example: '12345678901234' },
        birthDate: { type: 'string', example: '2000-01-15' },
        direction: { type: 'string', example: 'Backend' },
        groupIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
          example: ['70b32892-1698-47b9-87fe-002590f8f88f'],
        },
        photo: {
          type: 'string',
          format: 'binary',
          description: 'Ixtiyoriy. JPG, PNG, WEBP, max 5MB',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Talaba muvaffaqiyatli yaratildi',
    schema: {
      example: {
        data: {
          id: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
          fullName: 'Muxamadaliyev Ibroxim',
          phone: '+998900113000',
          balance: 0,
          photoUrl: 'uploads/students/student_1710000000000.jpg',
          enrolledGroups: [{ id: 'uuid', name: 'Node.js Backend' }],
          createdAt: '2026-03-13T10:00:00.000Z',
        },
        statusCode: 201,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Validatsiya xatosi yoki rasm formati noto'g'ri",
    schema: {
      example: {
        statusCode: 400,
        message: 'Faqat rasm fayllari qabul qilinadi',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({ status: 409, description: 'Telefon raqami allaqachon mavjud' })
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
      "Ism, telefon yoki guruh nomi bo'yicha qidirish va sahifalash imkoniyati bilan.",
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
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: {
          items: [
            {
              id: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
              fullName: 'Alisher Karimov',
              phone: '+998901234567',
              balance: 500000,
              photoUrl: 'uploads/students/student_123.jpg',
              enrolledGroups: [{ id: 'uuid', name: 'Node.js Backend' }],
            },
          ],
          meta: { totalItems: 87, totalPages: 9, currentPage: 1 },
        },
        statusCode: 200,
        timestamp: '2026-03-13 10:00:00',
      },
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
      "Soft-delete qilingan talabalar ro'yxati. Restore orqali qaytarish mumkin.",
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: {
          items: [
            {
              id: 'uuid',
              fullName: 'Zulfiya Rahimova',
              phone: '+998909876543',
              deletedAt: '2026-02-01T10:00:00.000Z',
            },
          ],
          meta: { totalItems: 3, totalPages: 1, currentPage: 1 },
        },
        statusCode: 200,
        timestamp: '2026-03-13 10:00:00',
      },
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
    summary: "Bitta talaba ma'lumotlari",
    description:
      "ID bo'yicha talabaning to'liq ma'lumotlari: guruhlar, to'lovlar, davomat, imtiyozlar.",
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: {
          id: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
          fullName: 'Alisher Karimov',
          phone: '+998901234567',
          parentName: 'Karimov Baxtiyor',
          parentPhone: '+998901234568',
          documentType: 'passport',
          documentNumber: 'AB1234567',
          pinfl: '12345678901234',
          birthDate: '2000-01-15',
          direction: 'Backend',
          balance: 500000,
          photoUrl: 'uploads/students/student_123.jpg',
          enrolledGroups: [
            { id: 'uuid', name: 'Node.js Backend', price: 800000 },
          ],
          discounts: [{ groupId: 'uuid', customPrice: 600000 }],
          createdAt: '2026-01-01T10:00:00.000Z',
        },
        statusCode: 200,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Talaba topilmadi' })
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
      "Talabaning istalgan ma'lumotini yangilash. Rasm ixtiyoriy — yangi rasm yuborilsa eski o'chiriladi.",
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fullName: { type: 'string', example: 'Ali Valiyev' },
        phone: { type: 'string', example: '+998901234567' },
        parentName: { type: 'string', example: 'Valiyev Hamid' },
        parentPhone: { type: 'string', example: '+998901234568' },
        birthDate: { type: 'string', example: '2000-01-15' },
        direction: { type: 'string', example: 'Frontend' },
        documentType: {
          type: 'string',
          enum: ['passport', 'birth_certificate'],
        },
        documentNumber: { type: 'string', example: 'AB1234567' },
        pinfl: { type: 'string', example: '12345678901234' },
        groupIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
          example: ['uuid-1', 'uuid-2'],
        },
        discounts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              groupId: { type: 'string', format: 'uuid' },
              customPrice: { type: 'number', example: 600000, nullable: true },
            },
          },
        },
        photo: {
          type: 'string',
          format: 'binary',
          description: 'Ixtiyoriy. JPG, PNG, WEBP, max 5MB',
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
    schema: {
      example: {
        data: {
          id: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
          fullName: 'Ali Valiyev',
          phone: '+998901234567',
          balance: 500000,
          photoUrl: 'uploads/students/student_1710000001234.jpg',
          enrolledGroups: [{ id: 'uuid', name: 'Node.js Backend' }],
          updatedAt: '2026-03-13T10:00:00.000Z',
        },
        statusCode: 200,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Talaba topilmadi' })
  @ApiResponse({ status: 409, description: 'Telefon raqami allaqachon mavjud' })
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
      "Talaba o'chirilmaydi, arxivlanadi. /restore orqali qaytariladi.",
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: { message: 'Talaba arxivlandi' },
        statusCode: 200,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Talaba topilmadi' })
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
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: {
          id: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
          fullName: 'Alisher Karimov',
          phone: '+998901234567',
          deletedAt: null,
        },
        statusCode: 200,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Talaba topilmadi' })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.restore(id);
  }
}
