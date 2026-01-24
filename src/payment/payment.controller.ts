import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { PaymentsService } from './payment.service';
import { CreatePaymentDto } from './payment.dto';

@ApiTags("To'lovlar (Payments)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  @ApiOperation({ summary: "Yangi to'lovni amalga oshirish" })
  @ApiResponse({
    status: 201,
    description: "To'lov muvaffaqiyatli saqlandi.",
  })
  @ApiResponse({
    status: 400,
    description: "Yuborilgan ma'lumotlar xato (Validation error).",
  })
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "To'lovlar ro'yxatini pagination bilan olish" })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
  ) {
    // String bo'lib keladigan querylarni numberga o'tkazish muhim
    return this.paymentsService.findAll(+page, +limit, search);
  }
}
