// import {
//   Controller,
//   Get,
//   Post,
//   Body,
//   Patch,
//   Param,
//   Delete,
//   Query,
//   UseGuards,
//   UseInterceptors,
//   BadRequestException,
//   UploadedFile,
// } from '@nestjs/common';
// import {
//   ApiTags,
//   ApiOperation,
//   ApiQuery,
//   ApiBearerAuth,
//   ApiResponse,
// } from '@nestjs/swagger';
// import { StudentsService } from './students.service';
// import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
// import { CreateStudentDto, UpdateStudentDto } from './student.dto';
// import { RolesGuard } from '../common/guards/roles.guard';
// import { Roles } from '../common/guards/roles.decarator';
// import { UserRole } from '../entities/user.entity';
// import { FileInterceptor } from '@nestjs/platform-express';

// @ApiTags('Students')
// @ApiBearerAuth()
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Controller('students')
// export class StudentsController {
//   constructor(private readonly studentsService: StudentsService) {}

//   @Post()
//   @Roles(UserRole.ADMIN)
//   @ApiOperation({ summary: "Yangi student qo'shish va guruhlarga biriktirish" })
//   @ApiResponse({
//     status: 201,
//     description: 'Student muvaffaqiyatli yaratildi.',
//   })
//   create(@Body() dto: CreateStudentDto) {
//     return this.studentsService.create(dto); //
//   }

//   @Get()
//   @ApiOperation({
//     summary: 'Barcha studentlarni pagination va filtr bilan olish',
//   })
//   @ApiQuery({
//     name: 'search',
//     required: false,
//     description: "Ism yoki telefon bo'yicha qidiruv",
//   })
//   @ApiQuery({
//     name: 'groupName',
//     required: false,
//     description: "Yo'nalish nomi bo'yicha filtr",
//   })
//   @ApiQuery({ name: 'page', required: false, example: 1 })
//   @ApiQuery({ name: 'limit', required: false, example: 10 })
//   findAll(
//     @Query('search') search?: string,
//     @Query('groupName') groupName?: string,
//     @Query('page') page: number = 1,
//     @Query('limit') limit: number = 10,
//   ) {
//     // Service-dagi pagination va qidiruv mantiqi chaqiriladi
//     return this.studentsService.findAll(search, groupName, page, limit);
//   }

//   @Post(':id/photo')
//   @UseInterceptors(
//     FileInterceptor('photo', {
//       dest: './uploads/students',
//       fileFilter: (req, file, cb) => {
//         if (!file.mimetype.startsWith('image/')) {
//           return cb(new BadRequestException('Faqat rasm yuklang!'), false);
//         }
//         cb(null, true);
//       },
//       limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
//     }),
//   )
//   async uploadPhoto(
//     @Param('id') id: string,
//     @UploadedFile() file: Express.Multer.File,
//   ) {
//     return this.studentsService.savePhotoAndDescriptor(id, file);
//   }

//   @Get(':id')
//   @Roles(UserRole.ADMIN)
//   @ApiOperation({
//     summary: "Student haqida to'liq ma'molot (Guruhlar, to'lovlar, davomat)",
//   })
//   findOne(@Param('id') id: string) {
//     return this.studentsService.findOne(id); //
//   }

//   @Patch(':id')
//   @Roles(UserRole.ADMIN)
//   @ApiOperation({ summary: "Student ma'lumotlarini yangilash (Patch)" })
//   update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
//     // Ma'lumotlarni qisman yangilash
//     return this.studentsService.update(id, dto);
//   }

//   @Delete(':id')
//   @Roles(UserRole.ADMIN)
//   @ApiOperation({ summary: 'Studentni arxivlash (Soft Delete)' })
//   remove(@Param('id') id: string) {
//     // O'quvchini bazadan o'chirmasdan arxivlaydi
//     return this.studentsService.remove(id);
//   }

//   @Get('all/deleted/students')
//   @Roles(UserRole.ADMIN)
//   @ApiOperation({ summary: 'Barcha arxivlangan studentlarni olish' })
//   @ApiQuery({
//     name: 'search',
//     required: false,
//     description: "Ism yoki telefon bo'yicha qidiruv",
//   })
//   @ApiQuery({ name: 'page', required: false, example: 1 })
//   @ApiQuery({ name: 'limit', required: false, example: 10 })
//   findAllDeleted(
//     @Query('search') search?: string,
//     @Query('page') page: number = 1,
//     @Query('limit') limit: number = 10,
//   ) {
//     return this.studentsService.findAllDeleted(search, page, limit);
//   }

//   @Post('restore/student/:id')
//   @Roles(UserRole.ADMIN)
//   @ApiOperation({ summary: 'Arxivlangan studentni tiklash' })
//   restore(@Param('id') id: string) {
//     return this.studentsService.restore(id);
//   }
// }
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
import { CreateStudentDto } from './student.dto';

@ApiTags('Students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  // ─────────────────────────────────────────────
  // POST /students — yangi student qo'shish (rasm yo'q)
  // ─────────────────────────────────────────────
  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Yangi talaba qo'shish",
    description:
      "Faqat talaba ma'lumotlari saqlanadi. Rasm keyinchalik UPDATE orqali yuklanadi.",
  })
  async create(@Body() dto: CreateStudentDto) {
    return this.studentsService.create(dto);
  }

  // ─────────────────────────────────────────────
  // GET /students — barcha studentlar
  // ─────────────────────────────────────────────
  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: "Barcha talabalar ro'yxati" })
  @ApiQuery({ name: 'search', required: false, description: 'Ism yoki telefon' })
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
@ApiOperation({
  summary: "Talaba ma'lumotlarini yangilash (rasm ixtiyoriy)",
  description:
    "Faqat yuborilgan maydonlar yangilanadi. Bo'sh yoki yuborilmagan maydonlar o'zgarmaydi.",
})
@ApiConsumes('multipart/form-data')
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      fullName:       { type: 'string', example: 'Ali Valiyev', description: "To'liq ism" },
      phone:          { type: 'string', example: '+998901234567' },
      parentName:     { type: 'string', example: 'Vali Valiyev' },
      parentPhone:    { type: 'string', example: '+998901234568' },
      birthDate:      { type: 'string', example: '2000-01-01' },
      direction:      { type: 'string', example: 'nodejs' },
      documentType:   { type: 'string', example: 'passport', enum: ['passport', 'birth_certificate', 'id_card'] },
      documentNumber: { type: 'string', example: 'AA1234567' },
      pinfl:          { type: 'string', example: '12345678901234' },
      groupIds:       { type: 'string', example: '["uuid-1","uuid-2"]', description: 'JSON string formatida' },
      discounts:      { type: 'string', example: '[{"groupId":"uuid","customPrice":500000}]', description: 'JSON string formatida' },
      photo: {
        type: 'string',
        format: 'binary',
        description: 'Ixtiyoriy. Yuborilsa yuz tahlil qilinib face ID yangilanadi. (JPG, PNG, WEBP, max 5MB)',
      },
    },
  },
})
@UseInterceptors(
  FileInterceptor('photo', {
    dest: './uploads/students/tmp',
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
        cb(
          new BadRequestException('Faqat JPG, PNG, WEBP formatidagi rasmlar ruxsat etiladi'),
          false,
        );
      } else {
        cb(null, true);
      }
    },
  }),
)
async update(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() body: any,
  @UploadedFile() file?: Express.Multer.File,
) {
  // multipart/form-data → JSON parse
  if (body.groupIds && typeof body.groupIds === 'string') {
    try {
      body.groupIds = JSON.parse(body.groupIds);
    } catch {
      throw new BadRequestException('groupIds noto\'g\'ri format. Misol: ["uuid-1","uuid-2"]');
    }
  }

  if (body.discounts && typeof body.discounts === 'string') {
    try {
      body.discounts = JSON.parse(body.discounts);
    } catch {
      throw new BadRequestException('discounts noto\'g\'ri format. Misol: [{"groupId":"uuid","customPrice":500000}]');
    }
  }

  return this.studentsService.update(id, body, file);
}
  // ─────────────────────────────────────────────
  // DELETE /students/:id — softDelete
  // ─────────────────────────────────────────────
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Talabani arxivlash (soft delete)",
    description: "Talaba o'chirilmaydi, arxivlanadi. Restore orqali qaytariladi.",
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.remove(id);
  }

  // ─────────────────────────────────────────────
  // PATCH /students/:id/restore — arxivdan qaytarish
  // ─────────────────────────────────────────────
  @Patch(':id/restore')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Arxivlangan talabani tiklash" })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.restore(id);
  }
}