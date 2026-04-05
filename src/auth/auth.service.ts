import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.userRepo.findOne({
      where: { login: loginDto.login },
      select: ['id', 'password', 'role', 'fullName'],
      relations: ['branch'],
    });
    if (!user) {
      this.logger.warn(
        `Muvaffaqiyatsiz login urinishi - Foydalanuvchi topilmadi [login: ${loginDto.login}]`,
      );
      throw new UnauthorizedException('Login xato!');
    }

    if (!(await bcrypt.compare(loginDto.password, user.password))) {
      // SABABI: Muvaffaqiyatsiz login urinishi - xavfsizlik audit uchun
      this.logger.warn(
        `Muvaffaqiyatsiz login urinishi - Parol noto'g'ri [login: ${loginDto.login}]`,
      );
      throw new UnauthorizedException('Parol xato!');
    }

    const branchId = user.branch ? user.branch.id : null;
    const tokens = await this.getTokens(user.id, user.role, branchId);
    await this.userRepo.update(user.id, { refreshToken: tokens.refreshToken });

    // SABABI: Kim, qachon tizimga kirdi — audit uchun
    this.logger.log(
      `Foydalanuvchi tizimga kirdi [id: ${user.id}] [role: ${user.role}]`,
    );

    return {
      ...tokens,
      user: { id: user.id, fullName: user.fullName, role: user.role, branchId },
    };
  }

  async refreshTokens(refreshToken: string) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch (error) {
      throw new UnauthorizedException(
        'Refresh token muddati tugagan yoki yaroqsiz!',
      );
    }

    const userId = payload?.sub;
    if (!userId) {
      throw new UnauthorizedException(
        "Token ichida foydalanuvchi ma'lumoti yo'q",
      );
    }

    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'role', 'refreshToken', 'fullName'],
      relations: ['branch'],
    });

    if (!user || !user.refreshToken || user.refreshToken !== refreshToken) {
      // SABABI: Token qayta ishlatilishi mumkin — xavfsizlik hodisasi
      this.logger.warn(
        `Refresh token bazada topilmadi — token reuse urinishi [userId: ${userId}]`,
      );
      throw new UnauthorizedException(
        "Refresh token bazada topilmadi (allaqachon ishlatilgan bo'lishi mumkin)!",
      );
    }

    const branchId = user.branch ? user.branch.id : null;
    const tokens = await this.getTokens(user.id, user.role, branchId);
    await this.userRepo.update(user.id, { refreshToken: tokens.refreshToken });

    return {
      ...tokens,
      user: { id: user.id, fullName: user.fullName, role: user.role, branchId },
    };
  }

  async logout(userId: string) {
    await this.userRepo.update(userId, { refreshToken: null });
    // SABABI: Kim, qachon tizimdan chiqdi — audit uchun
    this.logger.log(`Foydalanuvchi tizimdan chiqdi [id: ${userId}]`);
    return { success: true, message: 'Tizimdan muvaffaqiyatli chiqildi' };
  }

  private async getTokens(
    userId: number | string,
    role: string,
    branchId: string | null,
  ) {
    // TUZATISH: JWT_SECRET va JWT_REFRESH_SECRET undefined bo'lsa
    // token imzosiz yaratiladi — .env da bo'lmasa darhol xato bersin
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    const jwtRefreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET');

    if (!jwtSecret || !jwtRefreshSecret) {
      this.logger.error('JWT_SECRET yoki JWT_REFRESH_SECRET .env da topilmadi');
      throw new Error('JWT secret konfiguratsiyasi topilmadi');
    }

    const payload = { sub: userId, role, branchId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtSecret,
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: jwtRefreshSecret,
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
