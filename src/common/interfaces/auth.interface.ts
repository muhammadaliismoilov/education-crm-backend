import { Request } from 'express';
import { UserRole } from '../../entities/user.entity';

/**
 * JWT payload dan kelgan foydalanuvchi ma'lumotlari.
 * Barcha guard, service va controller larda `user: any` o'rniga shu ishlatiladi.
 *
 * @property id        - Foydalanuvchi UUID identifikatori
 * @property login     - Foydalanuvchi login (email/username)
 * @property role      - Foydalanuvchi roli: SUPERADMIN | ADMIN | MANAGER | TEACHER
 * @property branchId  - Biriktirilgan filial UUID. SUPERADMIN da bo'lmasligi mumkin.
 * @property fullName  - To'liq ism (audit log uchun ixtiyoriy)
 * @property iat       - JWT token yaratilgan vaqt (Unix timestamp)
 * @property exp       - JWT token muddati tugash vaqti (Unix timestamp)
 */
export interface AuthenticatedUser {
  id: string;
  login: string;
  role: UserRole;
  branchId?: string;
  fullName?: string;
  iat?: number;
  exp?: number;
}

/**
 * Express Request ni kengaytiruvchi authenticated request type.
 * Controller larda `@Req() req: IAuthenticatedRequest` sifatida ishlatiladi.
 */
export interface IAuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
