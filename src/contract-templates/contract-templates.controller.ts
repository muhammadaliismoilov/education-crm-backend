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
} from '@nestjs/common';
import { ContractTemplatesService } from './contract-templates.service';
import {
  CreateContractTemplateDto,
  UpdateContractTemplateDto,
} from './dto/contract-template.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/guards/roles.decarator';
import { UserRole } from '../entities/user.entity';

const TEMPLATE_EXAMPLE = {
  id: 'uuid-string',
  title: 'Standard English Course Contract',
  content: { title: 'Shartnoma №{{contractNumber}}', body: "{{studentName}} bilan {{branchName}} markazi o'rtasida..." },
  branch: { id: 'uuid', name: 'Tashkent' },
  createdAt: '2025-04-01T10:00:00Z',
  updatedAt: '2025-04-01T10:00:00Z',
};

const WRAP = (data: any, statusCode = 200) => ({
  data,
  statusCode,
  timestamp: new Date().toISOString(),
});

@ApiTags('Shartnoma Shablonlari (Contract Templates)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contract-templates')
export class ContractTemplatesController {
  constructor(
    private readonly contractTemplatesService: ContractTemplatesService,
  ) {}

  @ApiOperation({
    summary: 'Yangi shablon yaratish',
    description: "Tizimga yangi shartnoma shablonini qo'shadi. Ushbu shablon keyinchalik talabalar bilan shartnoma yaratishda asos bo'lib xizmat qiladi. Shablon matni (content) JSON formatida kiritilishi talab etiladi. " +
      "Faqat Admin va Superadminlar uchun ruxsat berilgan.",
  })
  @ApiResponse({
    status: 201,
    description: "Shablon muvaffaqiyatli yaratildi.",
    schema: { example: WRAP(TEMPLATE_EXAMPLE, 201) },
  })
  @ApiResponse({ status: 400, description: "Noto'g'ri ma'lumotlar kiritildi." })
  create(@Body() dto: CreateContractTemplateDto, @Req() req: any) {
    return this.contractTemplatesService.create(dto, req.user);
  }

  @Get()
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: "Barcha shablonlarni ko'rish",
    description: "Tizimdagi (filialga tegishli) barcha mavjud shablonlar ro'yxatini qaytaradi.",
  })
  @ApiResponse({
    status: 200,
    description: "Mavjud shablonlar ro'yxati.",
    schema: { example: WRAP([TEMPLATE_EXAMPLE], 200) },
  })
  findAll(@Req() req: any) {
    return this.contractTemplatesService.findAll(req.user);
  }

  @Get(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ 
    summary: "Bitta shablonni ko'rish",
    description: "ID orqali aniq bir shablonning barcha ma'lumotlarini (nomi va matni) oladi." 
  })
  @ApiResponse({
    status: 200,
    description: "Shablon ma'lumotlari.",
    schema: { example: WRAP(TEMPLATE_EXAMPLE, 200) },
  })
  @ApiResponse({ status: 404, description: 'Shablon topilmadi.' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.contractTemplatesService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Shablonni tahrirlash',
    description: "Mavjud shablonning nomi yoki matnini (JSON formatida) yangilaydi." 
  })
  @ApiResponse({
    status: 200,
    description: 'Shablon muvaffaqiyatli yangilandi.',
    schema: { example: WRAP(TEMPLATE_EXAMPLE, 200) },
  })
  @ApiResponse({ status: 404, description: 'Shablon topilmadi.' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContractTemplateDto,
    @Req() req: any,
  ) {
    return this.contractTemplatesService.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  @ApiOperation({ 
    summary: "Shablonni o'chirish",
    description: "Mavjud shablonni tizimdan o'chirib tashlaydi." 
  })
  @ApiResponse({
    status: 200,
    description: "Shablon muvaffaqiyatli o'chirildi.",
    schema: { example: WRAP({ message: "Shablon o'chirildi" }, 200) },
  })
  @ApiResponse({ status: 404, description: 'Shablon topilmadi.' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.contractTemplatesService.remove(id, req.user);
  }
}
