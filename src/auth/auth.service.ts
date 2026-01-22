import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/entities/user.entity';

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

    if (user && (await bcrypt.compare(loginDto.password, user.password))) {
      const payload = { sub: user.id, role: user.role };
      return {
        user: { id: user.id, fullName: user.fullName, role: user.role },
        access_token: this.jwtService.sign(payload),
      };
    }
    throw new UnauthorizedException('Login yoki parol xato!');
  }
}
