import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'; // Agar bu fayl yo'q bo'lsa, pastda yozib beraman

@ApiTags('Auth - Tizimga kirish') // Swaggerda bo'lim nomi
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login va Parol orqali token olish' })
  @ApiResponse({ status: 200, description: 'Muvaffaqiyatli kirish, JWT qaytariladi' })
  @ApiResponse({ status: 401, description: 'Login yoki parol xato' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth() // Swaggerda qulf belgisi (token yuborish uchun)
  @ApiOperation({ summary: 'Joriy foydalanuvchi ma\'lumotlarini olish' })
  async getProfile(@Req() req) {
    // req.user JwtStrategy'dan keladi
    return req.user;
  }
}