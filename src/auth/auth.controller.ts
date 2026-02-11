import { Controller, Post, Body, Res, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Response, Request } from 'express';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { LoginDto } from './login.dto';
 import { JwtService } from '@nestjs/jwt';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.login(loginDto);

    // Tokenlarni cookie-ga joylaymiz
    this.setCookies(res, accessToken, refreshToken);

    return { message: 'Xush kelibsiz!', user, accessToken ,refreshToken};
  }

@Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') bodyRefreshToken?: string,
  ) {
    // 1. Tokenni Cookie yoki Body'dan olamiz
    const refreshToken = req.cookies?.refresh_token || bodyRefreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token topilmadi');
    }

    try {
      const payload = this.jwtService.decode(refreshToken) as any;
      const userId = payload?.sub;

      if (!userId) {
        throw new UnauthorizedException('Token ichida foydalanuvchi ma’lumoti yo’q');
      }

      // 3. AuthService orqali tokenlarni yangilaymiz
      const { accessToken, refreshToken: newRefreshToken, user } =
        await this.authService.refreshTokens(userId, refreshToken);

      // 4. Yangi tokenlarni cookie-ga yozamiz
      this.setCookies(res, accessToken, newRefreshToken);

      return { accessToken, refreshToken: newRefreshToken, user };
    } catch (error) {
      throw new UnauthorizedException('Tokenni qayta ishlashda xatolik');
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.user.id);

    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    return { message: 'Tizimdan chiqildi' };
  }

  // Helper metod: Cookie-larni sozlashni markazlashtirish
  private setCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minut
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 kun
    });
  }
}