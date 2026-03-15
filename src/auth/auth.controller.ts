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

// ─── Reusable examples ───────────────────────────────────────────────────────

const TOKEN_EXAMPLE = {
  accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1dWlkIn0...',
  refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1dWlkIn0...',
};

const USER_EXAMPLE = {
  id: 'f6ed8de6-1f66-4f20-b1da-aecd5bc2b5a8',
  fullName: 'Admin User',
  role: 'admin',
};

const WRAP = (data: any, statusCode = 200) => ({
  data,
  statusCode,
  timestamp: '2026-03-13 10:00:00',
});

// ─────────────────────────────────────────────────────────────────────────────

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─────────────────────────────────────────────
  // POST /auth/login
  // ─────────────────────────────────────────────
  @Post('login')
  @ApiOperation({
    summary: 'Tizimga kirish',
    description:
      'Login va parol orqali tizimga kirish. ' +
      'Access token (15 daqiqa) cookie va response body da qaytariladi. ' +
      'Refresh token (7 kun) cookie da saqlanadi.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 201,
    description: 'Muvaffaqiyatli kirish',
    schema: {
      example: WRAP(
        {
          // TUZATISH: service { accessToken, refreshToken, user } qaytaradi —
          // controller message qo'shib, cookie ga ham yozadi
          message: 'Xush kelibsiz!',
          user: USER_EXAMPLE,
          ...TOKEN_EXAMPLE,
        },
        201,
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Login yoki parol xato',
    schema: {
      example: {
        statusCode: 401,
        message: 'Login yoki parol xato!',
        error: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validatsiya xatosi',
    schema: {
      example: {
        statusCode: 400,
        message: ["Parol kamida 6 ta belgidan iborat bo'lishi kerak"],
        error: 'Bad Request',
      },
    },
  })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.login(loginDto);
    this.setCookies(res, accessToken, refreshToken);
    return { message: 'Xush kelibsiz!', user, accessToken, refreshToken };
  }

  // ─────────────────────────────────────────────
  // POST /auth/refresh
  // ─────────────────────────────────────────────
  @Post('refresh')
  @ApiOperation({
    summary: 'Tokenlarni yangilash',
    description:
      'Refresh token orqali yangi access va refresh token olish. ' +
      'Token cookie yoki body dan olinadi. ' +
      'Token rotation — eski refresh token bekor qilinadi.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: {
          type: 'string',
          description: 'Cookie ishlamasa body dan yuborish mumkin',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Tokenlar muvaffaqiyatli yangilandi',
    schema: {
      example: WRAP(
        {
          // service { accessToken, refreshToken, user } qaytaradi — mos
          ...TOKEN_EXAMPLE,
          user: USER_EXAMPLE,
        },
        201,
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Token yaroqsiz, muddati tugagan yoki qayta ishlatilgan',
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
    if (!refreshToken)
      throw new UnauthorizedException('Refresh token topilmadi');

    const {
      accessToken,
      refreshToken: newRefreshToken,
      user,
    } = await this.authService.refreshTokens(refreshToken);

    this.setCookies(res, accessToken, newRefreshToken);
    return { accessToken, refreshToken: newRefreshToken, user };
  }

  // ─────────────────────────────────────────────
  // POST /auth/logout
  // ─────────────────────────────────────────────
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Tizimdan chiqish',
    description:
      "Refresh token bazadan o'chiriladi, cookie lar tozalanadi. " +
      "Keyingi so'rovlarda access token ishlamaydi.",
  })
  @ApiResponse({
    status: 201,
    description: 'Muvaffaqiyatli chiqish',
    schema: {
      example: WRAP(
        {
          // TUZATISH: controller o'zi { success, message } qaytaradi —
          // service 'Tizimdan muvaffaqiyatli chiqildi' deydi,
          // lekin controller 'Tizimdan chiqildi' deydi — controller yutadi
          success: true,
          message: 'Tizimdan chiqildi',
        },
        201,
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: "Token yo'q yoki yaroqsiz",
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
        error: 'Unauthorized',
      },
    },
  })
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.user.id);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return { success: true, message: 'Tizimdan chiqildi' };
  }

  // ─────────────────────────────────────────────
  // PRIVATE
  // ─────────────────────────────────────────────
  private setCookies(res: Response, accessToken: string, refreshToken: string) {
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
