import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // 1. Login - Birinchi marta tokenlarni berish
  async login(loginDto: any) {
    const user = await this.userRepo.findOne({
      where: { login: loginDto.login },
      select: ['id', 'password', 'role', 'fullName'],
    });

    if (!user || !(await bcrypt.compare(loginDto.password, user.password))) {
      throw new UnauthorizedException('Login yoki parol xato!');
    }

    // Tokenlarni generatsiya qilish
    const tokens = await this.getTokens(user.id, user.role);

    // Refresh tokenni bazaga saqlash
    await this.userRepo.update(user.id, { refreshToken: tokens.refreshToken });

    return {
      ...tokens,
      user: { id: user.id, fullName: user.fullName, role: user.role },
    };
  }

  // 2. Refresh Tokens - Access va Refresh tokenlarni yangilash
  async refreshTokens(refreshToken: string) {
  // 1. Avval JWT ni verify qilamiz (muddati o'tganini tekshiradi)
  let payload: any;
  try {
    payload = await this.jwtService.verifyAsync(refreshToken, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
    });
  } catch (error) {
    // verify muvaffaqiyatsiz = token yaroqsiz yoki muddati o'tgan
    throw new UnauthorizedException('Refresh token muddati tugagan yoki yaroqsiz!');
  }

  const userId = payload?.sub;
  if (!userId) {
    throw new UnauthorizedException('Token ichida foydalanuvchi ma\'lumoti yo\'q');
  }

  // 2. Bazadan foydalanuvchini topamiz
  const user = await this.userRepo.findOne({
    where: { id: userId },
    select: ['id', 'role', 'refreshToken', 'fullName'],
  });

  // 3. Bazadagi token bilan kelgan tokenni solishtiramiz (Rotation xavfsizligi)
  if (!user || !user.refreshToken || user.refreshToken !== refreshToken) {
    throw new UnauthorizedException('Refresh token bazada topilmadi (allaqachon ishlatilgan bo\'lishi mumkin)!');
  }

  // 4. Yangi tokenlar juftligini yaratamiz
  const tokens = await this.getTokens(user.id, user.role);

  // 5. Bazadagi refresh tokenni yangilaymiz
  await this.userRepo.update(user.id, {
    refreshToken: tokens.refreshToken,
  });

  return {
    ...tokens,
    user: { id: user.id, fullName: user.fullName, role: user.role },
  };
}

  // 3. Logout - Refresh tokenni o'chirish
  async logout(userId: string) {
    return await this.userRepo.update(userId, { refreshToken: null });
  }

  // 4. Helper - Tokenlarni generatsiya qilish mantiqi (Takrorlanishni oldini olish uchun)
  private async getTokens(userId: number | string, role: string) {
    const payload = { sub: userId, role: role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
