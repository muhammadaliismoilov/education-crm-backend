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
  // POST /students — yangi student qo'shish (rasm  ixtiyoriy)
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
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['fullName', 'phone', 'groupIds'],
      properties: {
        fullName: { type: 'string', example: 'Muxamadaliyev Ibroxim' },
        phone: { type: 'string', example: '+998900113000' },
        parentName: { type: 'string' },
        parentPhone: { type: 'string' },
        documentType: {
          type: 'string',
          enum: ['passport', 'birth_certificate'],
        },
        documentNumber: { type: 'string' },
        pinfl: { type: 'string' },
        birthDate: { type: 'string', example: '2000-01-01' },
        direction: { type: 'string' },
        groupIds: {
          type: 'array',
          items: { type: 'string' },
          example: ['70b32892-1698-47b9-87fe-002590f8f88f'],
        },
        photo: {
          type: 'string',
          format: 'binary', // ← Swagger da fayl yuklash tugmasi chiqadi
        },
      },
    },
  })
  async create(
    @Body() dto: CreateStudentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.studentsService.create(dto, file);
  }
  // ─────────────────────────────────────────────
  // GET /students — barcha studentlar
  // ─────────────────────────────────────────────
  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: "Barcha talabalar ro'yxati" })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Ism yoki telefon',
  })
  @ApiQuery({ name: 'groupName', required: false, description: 'Guruh nomi' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  async findAll(
    @Query('search') search?: string,
    @Query('groupName') groupName?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) {
    return this.studentsService.findAll(search, groupName, page, limit);
  }

  // ─────────────────────────────────────────────
  // GET /students/deleted — o'chirilgan studentlar
  // ─────────────────────────────────────────────
  @Get('deleted')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "O'chirilgan (arxivlangan) talabalar" })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  async findAllDeleted(
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) {
    return this.studentsService.findAllDeleted(search, page, limit);
  }

  // ─────────────────────────────────────────────
  // GET /students/:id — bitta student
  // ─────────────────────────────────────────────
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: "Bitta talaba ma'lumotlari" })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.findOne(id);
  }

  // ─────────────────────────────────────────────
  // PATCH /students/:id — ma'lumot + ixtiyoriy rasm yangilash
  // ─────────────────────────────────────────────

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Talaba ma'lumotlarini yangilash (rasm ixtiyoriy)" })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fullName: { type: 'string', example: 'Ali Valiyev' },
        phone: { type: 'string', example: '+998901234567' },
        parentName: { type: 'string' },
        parentPhone: { type: 'string' },
        birthDate: { type: 'string', example: '2000-01-01' },
        direction: { type: 'string' },
        documentType: {
          type: 'string',
          enum: ['passport', 'birth_certificate', 'id_card'],
        },
        documentNumber: { type: 'string' },
        pinfl: { type: 'string' },
        groupIds: {
          type: 'array',
          items: { type: 'string' },
          example: ['uuid-1', 'uuid-2'],
        },
        discounts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              groupId: { type: 'string' },
              customPrice: { type: 'number', nullable: true },
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
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.studentsService.update(id, dto, file);
  }
  // ─────────────────────────────────────────────
  // DELETE /students/:id — softDelete
  // ─────────────────────────────────────────────
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Talabani arxivlash (soft delete)',
    description:
      "Talaba o'chirilmaydi, arxivlanadi. Restore orqali qaytariladi.",
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.remove(id);
  }

  // ─────────────────────────────────────────────
  // PATCH /students/:id/restore — arxivdan qaytarish
  // ─────────────────────────────────────────────
  @Patch(':id/restore')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Arxivlangan talabani tiklash' })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.restore(id);
  }
}
