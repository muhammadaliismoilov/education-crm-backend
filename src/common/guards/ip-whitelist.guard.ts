import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Senior Level IP Whitelist Guard
 * Restricts access to specific IPs defined in ALLOWED_IPS (.env)
 */
@Injectable()
export class IpWhitelistGuard implements CanActivate {
  private readonly logger = new Logger(IpWhitelistGuard.name);

  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Ruxsat etilgan IP manzillar ro'yxatini .env'dan yuklash
    const allowedIpsStr = this.configService.get<string>('ALLOWED_IPS') || '';
    const allowedIps = allowedIpsStr
      .split(',')
      .map((ip) => ip.trim())
      .filter((ip) => ip.length > 0);

    // ALLOWED_IPS bo'sh bo'lsa — cheklov yo'q (development rejimi)
    // Lekin production'da bu XAVFLI, shuning uchun ogohlantirish chiqaramiz
    if (allowedIps.length === 0) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.warn(
          '⚠️  ALLOWED_IPS .env da ko\'rsatilmagan — IP cheklovi O\'CHIRILGAN! Production uchun xavfli!',
        );
      }
      return true;
    }

    // Client IP-manzili
    // 'trust proxy' yoqilgan bo'lsa Express request.ip'ni X-Forwarded-For'dan oladi.
    const clientIp = request.ip || request.socket.remoteAddress || '';

    // IP-manzilni normallashtirish (IPv6-mapped IPv4 manzillarini olib tashlash)
    // Masalan: ::ffff:127.0.0.1 -> 127.0.0.1
    const normalizedIp = clientIp.replace(/^::ffff:/, '');

    const isAllowed = allowedIps.includes(normalizedIp);

    if (!isAllowed) {
      this.logger.warn(`Bloklangan ulanish urinishi: IP [${normalizedIp}]`);
      throw new ForbiddenException(
        `Xavfsizlik choralari tufayli [${normalizedIp}] IP manziliga ruxsat yo'q.`,
      );
    }

    this.logger.debug(`Ruxsat berilgan ulanish: IP [${normalizedIp}]`);
    return true;
  }
}
