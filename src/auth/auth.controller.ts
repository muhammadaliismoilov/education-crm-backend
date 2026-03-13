// auth.controller.ts
import {
  Controller,
  Post,
  Body,
  Res,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import type { Response, Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { LoginDto } from './login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Tizimga kirish' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.login(loginDto);

    this.setCookies(res, accessToken, refreshToken);
    return { message: 'Xush kelibsiz!', user, accessToken, refreshToken };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Tokenlarni yangilash' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') bodyRefreshToken?: string,
  ) {
    const refreshToken = req.cookies?.refresh_token || bodyRefreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token topilmadi');
    }

    const { accessToken, refreshToken: newRefreshToken, user } =
      await this.authService.refreshTokens(refreshToken);

    this.setCookies(res, accessToken, newRefreshToken);
    return { accessToken, refreshToken: newRefreshToken, user };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tizimdan chiqish' })
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.user.id);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return { success: true, message: 'Tizimdan chiqildi' };
  }

  private setCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    // TUZATISH: process.env o'rniga ConfigService ishlatish kerak,
    // lekin controller da inject qilish murakkashligini oldini olish uchun
    // NODE_ENV tekshiruvi to'g'ri — shu holda qoldirildi
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}