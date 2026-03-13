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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import type { Response, Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { LoginDto } from './login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({
    summary: 'Tizimga kirish',
    description: "Login va parol orqali tizimga kirish. Access token (15 daqiqa) va Refresh token (7 kun) qaytariladi.",
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 201,
    description: 'Muvaffaqiyatli kirish',
    schema: {
      example: {
        data: {
          message: 'Xush kelibsiz!',
          user: { id: 'uuid', fullName: 'Admin User', role: 'admin' },
          accessToken: 'eyJhbGciOiJIUzI1NiJ9...',
          refreshToken: 'eyJhbGciOiJIUzI1NiJ9...',
        },
        statusCode: 201,
        timestamp: '2026-03-13 10:00:00',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Login yoki parol xato',
    schema: {
      example: { statusCode: 401, message: 'Login yoki parol xato!', error: 'Unauthorized' },
    },
  })
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.login(loginDto);
    this.setCookies(res, accessToken, refreshToken);
    return { message: 'Xush kelibsiz!', user, accessToken, refreshToken };
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Tokenlarni yangilash',
    description: 'Refresh token orqali yangi access va refresh token olish. Token cookie yoki body dan olinadi.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: {
          type: 'string',
          description: "Cookie ishlamasa body dan yuborish mumkin",
          example: 'eyJhbGciOiJIUzI1NiJ9...',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Tokenlar muvaffaqiyatli yangilandi',
    schema: {
      example: {
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiJ9...',
          refreshToken: 'eyJhbGciOiJIUzI1NiJ9...',
          user: { id: 'uuid', fullName: 'Admin User', role: 'admin' },
        },
        statusCode: 201,
        timestamp: '2026-03-13 10:15:00',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Token yaroqsiz yoki muddati tugagan',
    schema: {
      example: {
        statusCode: 401,
        message: 'Refresh token muddati tugagan yoki yaroqsiz!',
        error: 'Unauthorized',
      },
    },
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') bodyRefreshToken?: string,
  ) {
    const refreshToken = req.cookies?.refresh_token || bodyRefreshToken;
    if (!refreshToken) throw new UnauthorizedException('Refresh token topilmadi');
    const { accessToken, refreshToken: newRefreshToken, user } =
      await this.authService.refreshTokens(refreshToken);
    this.setCookies(res, accessToken, newRefreshToken);
    return { accessToken, refreshToken: newRefreshToken, user };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tizimdan chiqish', description: 'Refresh token bazadan o\'chiriladi, cookie lar tozalanadi.' })
  @ApiResponse({
    status: 201,
    description: 'Muvaffaqiyatli chiqish',
    schema: {
      example: {
        data: { success: true, message: 'Tizimdan chiqildi' },
        statusCode: 201,
        timestamp: '2026-03-13 10:30:00',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Token yo\'q yoki yaroqsiz' })
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.user.id);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return { success: true, message: 'Tizimdan chiqildi' };
  }

  private setCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('access_token', accessToken, {
      httpOnly: true, secure: isProduction, sameSite: 'lax', maxAge: 15 * 60 * 1000,
    });
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true, secure: isProduction, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}