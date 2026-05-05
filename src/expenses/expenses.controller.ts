import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/guards/roles.decarator';
import { UserRole } from '../entities/user.entity';
import { ExpensesService } from './expenses.service';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  ExpenseFilterDto,
} from './expenses.dto';

@ApiTags('Expenses')
@ApiBearerAuth()
@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  // POST /expenses — Yangi xarajat yaratish
  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Yangi xarajat qo'shish" })
  @ApiResponse({
    status: 201,
    description: 'Xarajat muvaffaqiyatli yaratildi',
    schema: {
      example: {
        data: {
          id: 'b8e9b0e2-7649-416b-b2b9-e1ae9d9b02ae',
          amount: 500000,
          description: 'Ofis ijarasi',
          expenseDate: '2026-05-01',
          createdById: 'uuid',
          branchId: 'uuid',
          createdAt: '2026-05-03T10:00:00.000Z',
          updatedAt: '2026-05-03T10:00:00.000Z',
          deletedAt: null,
        },
        statusCode: 201,
        message: 'Xarajat yaratildi',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Noto'g'ri ma'lumotlar",
    schema: {
      example: {
        message: ["Miqdor musbat bo'lishi kerak"],
        error: 'Bad Request',
        statusCode: 400,
      },
    },
  })
  async create(@Body() dto: CreateExpenseDto, @Req() req: any) {
    const data = await this.expensesService.create(dto, req.user);
    return { data, statusCode: 201, message: 'Xarajat yaratildi' };
  }

  // GET /expenses — Barcha xarajatlar (filtrlash va sahifalash bilan)
  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: "Xarajatlar ro'yxati (filtrlash va sahifalash)" })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({
    name: 'month',
    required: false,
    example: '2026-05',
    description: 'YYYY-MM formatida oylik filter',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    example: '2026',
    description: 'YYYY formatida yillik filter',
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    description: 'Filial ID (faqat Superadmin)',
  })
  @ApiResponse({
    status: 200,
    description: "Xarajatlar ro'yxati muvaffaqiyatli qaytarildi",
    schema: {
      example: {
        data: [
          {
            id: 'b8e9b0e2-7649-416b-b2b9-e1ae9d9b02ae',
            amount: 500000,
            description: 'Ofis ijarasi',
            expenseDate: '2026-05-01',
            createdAt: '2026-05-03T10:00:00.000Z',
            createdBy: {
              id: 'uuid',
              fullName: 'Ali Valiyev',
              role: 'admin',
            },
          },
        ],
        meta: {
          totalItems: 1,
          totalPages: 1,
          currentPage: 1,
          itemsPerPage: 10,
        },
      },
    },
  })
  async findAll(@Query() filter: ExpenseFilterDto, @Req() req: any) {
    return this.expensesService.findAll(filter, req.user);
  }

  // GET /expenses/deleted — Arxivlangan xarajatlar ro'yxati
  @Get('deleted')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: "Arxivlangan xarajatlar ro'yxati (filtrlash va sahifalash bilan)",
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({
    name: 'month',
    required: false,
    example: '2026-05',
    description: 'YYYY-MM formatida oylik filter',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    example: '2026',
    description: 'YYYY formatida yillik filter',
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    description: 'Filial ID (faqat Superadmin)',
  })
  @ApiResponse({
    status: 200,
    description: "Arxivlangan xarajatlar ro'yxati muvaffaqiyatli qaytarildi",
    schema: {
      example: {
        data: [
          {
            id: 'b8e9b0e2-7649-416b-b2b9-e1ae9d9b02ae',
            amount: 500000,
            description: 'Ofis ijarasi',
            expenseDate: '2026-05-01',
            createdAt: '2026-05-03T10:00:00.000Z',
            deletedAt: '2026-05-03T11:00:00.000Z',
            createdBy: {
              id: 'uuid',
              fullName: 'Ali Valiyev',
              role: 'admin',
            },
          },
        ],
        meta: {
          totalItems: 1,
          totalPages: 1,
          currentPage: 1,
          itemsPerPage: 10,
        },
      },
    },
  })
  async findAllDeleted(@Query() filter: ExpenseFilterDto, @Req() req: any) {
    return this.expensesService.findAllDeleted(filter, req.user);
  }

  // GET /expenses/:id — Bitta xarajat
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: "Bitta xarajatni ko'rish" })
  @ApiResponse({
    status: 200,
    description: 'Bitta xarajat muvaffaqiyatli topildi',
    schema: {
      example: {
        data: {
          id: 'b8e9b0e2-7649-416b-b2b9-e1ae9d9b02ae',
          amount: 500000,
          description: 'Ofis ijarasi',
          expenseDate: '2026-05-01',
          createdAt: '2026-05-03T10:00:00.000Z',
        },
        statusCode: 200,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Xarajat topilmadi',
    schema: {
      example: {
        statusCode: 404,
        message: 'Xarajat topilmadi',
        error: 'Not Found',
      },
    },
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const data = await this.expensesService.findOne(id, req.user);
    return { data, statusCode: 200 };
  }

  // PATCH /expenses/:id — Xarajatni tahrirlash
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Xarajatni yangilash' })
  @ApiResponse({
    status: 200,
    description: 'Xarajat muvaffaqiyatli yangilandi',
    schema: {
      example: {
        data: {
          id: 'b8e9b0e2-7649-416b-b2b9-e1ae9d9b02ae',
          amount: 600000,
          description: 'Ofis ijarasi (yangilangan)',
          expenseDate: '2026-05-01',
          updatedAt: '2026-05-03T10:30:00.000Z',
        },
        statusCode: 200,
        message: 'Xarajat yangilandi',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Xarajat topilmadi',
    schema: {
      example: {
        statusCode: 404,
        message: 'Xarajat topilmadi',
        error: 'Not Found',
      },
    },
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
    @Req() req: any,
  ) {
    const data = await this.expensesService.update(id, dto, req.user);
    return { data, statusCode: 200, message: 'Xarajat yangilandi' };
  }

  // DELETE /expenses/:id — Xarajatni o'chirish (soft delete)
  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Xarajatni o'chirish (arxivlash)" })
  @ApiResponse({
    status: 204,
    description: "Xarajat muvaffaqiyatli o'chirildi (arxivlandi)",
  })
  @ApiResponse({
    status: 404,
    description: 'Xarajat topilmadi',
    schema: {
      example: {
        statusCode: 404,
        message: 'Xarajat topilmadi',
        error: 'Not Found',
      },
    },
  })
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    await this.expensesService.remove(id, req.user);
  }

  // POST /expenses/:id/restore — Arxivlangan xarajatni tiklash
  @Post(':id/restore')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Arxivlangan xarajatni qayta tiklash' })
  @ApiResponse({
    status: 200,
    description: 'Xarajat muvaffaqiyatli tiklandi',
    schema: {
      example: {
        data: {
          id: 'b8e9b0e2-7649-416b-b2b9-e1ae9d9b02ae',
          amount: 500000,
          description: 'Ofis ijarasi',
          expenseDate: '2026-05-01',
        },
        statusCode: 200,
        message: 'Xarajat tiklandi',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Xarajat topilmadi',
  })
  async restore(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const data = await this.expensesService.restore(id, req.user);
    return { data, statusCode: 200, message: 'Xarajat tiklandi' };
  }

  // DELETE /expenses/:id/hard — Xarajatni butunlay o'chirish
  @Delete(':id/hard')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Arxivlangan xarajatni butunlay o'chirish" })
  @ApiResponse({
    status: 204,
    description: "Xarajat bazadan butunlay o'chirildi",
  })
  @ApiResponse({
    status: 403,
    description: "Faqat arxivlangan xarajatni butunlay o'chirish mumkin",
    schema: {
      example: {
        statusCode: 403,
        message: "Faqat arxivlangan xarajatni butunlay o'chirish mumkin",
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Xarajat topilmadi',
  })
  async hardDelete(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    await this.expensesService.hardDelete(id, req.user);
  }
}
