import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 1. Headerdan "Bearer <token>" formatida qidirish
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // 2. Cookiedan "access_token" formatida qidirish (Zaxira uchun)
        (request: any) => {
          return request?.cookies?.access_token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // Payload ichidagi 'sub' (User ID) orqali foydalanuvchini topamiz
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user)
      throw new UnauthorizedException(
        'Foydalanuvchi topilmadi yoki token xato',
      );

    // MUHIM: JWT payload dan branchId va role ni req.user ga biriktirish
    // Bu barcha servislar uchun branch filtrlash asosi
    return {
      ...user,
      branchId: payload.branchId ?? null,
    };
  }
}
