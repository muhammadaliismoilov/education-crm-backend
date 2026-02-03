import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

// @Injectable()
// export class JwtStrategy extends PassportStrategy(Strategy) {
//   constructor(
//     @InjectRepository(User) private userRepo: Repository<User>,
//   ) {
//    super({
//       jwtFromRequest: ExtractJwt.fromExtractors([
//         (request: any) => {
//           return request?.cookies?.access_token;
//         },
//       ]),
//       ignoreExpiration: false,
//       secretOrKey: process.env.JWT_SECRET, 
//     });
//   }

//   async validate(payload: any) {
//     const user = await this.userRepo.findOne({ where: { id: payload.sub } });
//     if (!user) throw new UnauthorizedException('Token yaroqsiz');
//     return user;
//   }
// }

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 1. Headerdan "Bearer <token>" formatida qidirish (Sizning holatingizda shu ishlaydi)
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // 2. Cookiedan "access_token" formatida qidirish (Zaxira uchun)
        (request: any) => {
          return request?.cookies?.access_token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET, 
    });
  }

  async validate(payload: any) {
    // Payload ichidagi 'sub' (User ID) orqali foydalanuvchini topamiz
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('Foydalanuvchi topilmadi yoki token xato');
    return user;
  }
}