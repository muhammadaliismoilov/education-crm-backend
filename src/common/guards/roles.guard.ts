import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../entities/user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      'roles',
      [context.getHandler(), context.getClass()],
    );

    // 2. Agar @Roles dekoratori qo'yilmagan bo'lsa, kirishga ruxsat berish
    if (!requiredRoles) return true;

    // 3. Request-dan foydalanuvchini olish (JwtAuthGuard buni tayyorlab beradi)
    const { user } = context.switchToHttp().getRequest();
    // 4. Foydalanuvchining roli kerakli rollar orasida bor-yo'qligini tekshirish
    const hasPermission = user && requiredRoles.includes(user.role);

    if (!hasPermission) {
      throw new ForbiddenException(
        `❌ Sizda bu amalni bajarishga ruxsat yo‘q. Talab qilingan rollar: ${requiredRoles.join(', ')}. Sizning rolingiz: ${user?.role || 'Noaniq'}`,
      );
    }

    return true;
  }
}
