import { Controller, Post, Body, Res, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Response, Request } from 'express';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { LoginDto } from './login.dto';


@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.login(loginDto);

    // Access Tokenni cookie-ga joylaymiz
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    // Refresh Tokenni cookie-ga joylaymiz
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { message: 'Xush kelibsiz!', user , accessToken };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard) // Kim chiqayotganini bilishimiz uchun
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    // 1. Bazadagi tokenni o'chirish
    await this.authService.logout(req.user.id);

    // 2. Brauzerdagi cookie-larni tozalash
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    return { message: 'Tizimdan chiqildi' };
  }
}