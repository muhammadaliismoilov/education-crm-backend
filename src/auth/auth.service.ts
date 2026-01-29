import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { ConfigService } from '@nestjs/config'; // Qo'shildi
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService, // Inject qilindi
  ) {}

  async login(loginDto: any) {
    const user = await this.userRepo.findOne({
      where: { login: loginDto.login },
      select: ['id', 'password', 'role', 'fullName'],
    });

    if (!user || !(await bcrypt.compare(loginDto.password, user.password))) {
      throw new UnauthorizedException('Login yoki parol xato!');
    }

    const payload = { sub: user.id, role: user.role };

    // Secret-larni .env dan olamiz
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    await this.userRepo.update(user.id, { refreshToken: refreshToken });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, fullName: user.fullName, role: user.role },
    };
  }

  async logout(userId: string) {
    return await this.userRepo.update(userId, { refreshToken: null });
  }
}