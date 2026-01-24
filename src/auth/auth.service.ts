import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
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

    const accessToken = this.jwtService.sign(payload, {
      secret: 'birikkiuch',
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: 'to`rtbesholti',
      expiresIn: '7d',
    });

    // Endi xato bermaydi, chunki entity-da refreshToken bor
    await this.userRepo.update(user.id, { refreshToken: refreshToken });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, fullName: user.fullName, role: user.role },
    };
  }

  async logout(userId: string) {
  // Bazadan tokenni o'chirish
  return await this.userRepo.update(userId, { refreshToken: null });
}
}
