import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  Query, 
  UseGuards 
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiQuery, 
  ApiBearerAuth, 
  ApiResponse 
} from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CreateStudentDto, UpdateStudentDto } from './student.dto';

@ApiTags('Students')
@ApiBearerAuth() 
@UseGuards(JwtAuthGuard) 
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @ApiOperation({ summary: "Yangi student qo'shish va guruhlarga biriktirish" })
  @ApiResponse({ status: 201, description: "Student muvaffaqiyatli yaratildi." })
  create(@Body() dto: CreateStudentDto) {
    return this.studentsService.create(dto); //
  }

  @Get()
  @ApiOperation({ summary: "Barcha studentlarni pagination va filtr bilan olish" })
  @ApiQuery({ name: 'search', required: false, description: "Ism yoki telefon bo'yicha qidiruv" })
  @ApiQuery({ name: 'groupName', required: false, description: "Yo'nalish nomi bo'yicha filtr" })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  findAll(
    @Query('search') search?: string,
    @Query('groupName') groupName?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    // Service-dagi pagination va qidiruv mantiqi chaqiriladi
    return this.studentsService.findAll(search, groupName, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: "Student haqida to'liq ma'molot (Guruhlar, to'lovlar, davomat)" })
  findOne(@Param('id') id: string) {
    return this.studentsService.findOne(id); //
  }

  @Patch(':id')
  @ApiOperation({ summary: "Student ma'lumotlarini yangilash (Patch)" })
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    // Ma'lumotlarni qisman yangilash
    return this.studentsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: "Studentni arxivlash (Soft Delete)" })
  remove(@Param('id') id: string) {
    // O'quvchini bazadan o'chirmasdan arxivlaydi
    return this.studentsService.remove(id);
  }
  
  @Get('all/deleted/students')
  @ApiOperation({ summary: "Barcha arxivlangan studentlarni olish" })
  @ApiQuery({ name: 'search', required: false, description: "Ism yoki telefon bo'yicha qidiruv" })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  findAllDeleted(
    @Query('search') search?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.studentsService.findAllDeleted(search, page, limit);
  }

  @Post('restore/student/:id')
  @ApiOperation({ summary: "Arxivlangan studentni tiklash" })
  restore(@Param('id') id: string) {
    return this.studentsService.restore(id);
  }
}