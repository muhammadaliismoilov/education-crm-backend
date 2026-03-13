import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    const startTime = Date.now();

    // TUZATISH 1: ip o'rniga X-Forwarded-For ishlatiladi —
    // domen + nginx/proxy orqali kelganda req.ip har doim
    // ::ffff:127.0.0.1 (localhost) ko'rsatadi, haqiqiy IP yo'qoladi
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      req.ip;

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;

      // TUZATISH 2: 4xx/5xx xatolarni warn/error bilan ajratish —
      // hammasi log bo'lsa muhim xatolarni topish qiyinlashadi
      const message = `${method} ${originalUrl} ${statusCode} ${duration}ms - IP: ${ip}`;

      if (statusCode >= 500) {
        this.logger.error(message);
      } else if (statusCode >= 400) {
        this.logger.warn(message);
      } else {
        this.logger.log(message);
      }
    });

    next();
  }
}
