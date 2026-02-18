import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 1. Status kodni aniqlash
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // 2. Xatolik xabarini qat'iy aniqlash
    let message = 'Internal server error';
    
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      message = typeof res === 'object' ? res['message'] : res;
    } else if (exception.message) {
      // Bu yerda bazadan yoki boshqa joydan kelgan kutilmagan xatolik ushlanadi
      message = exception.message;
    }

    // 3. Terminalda (Log) xatoni to'liq ko'rish (Stack trace bilan)
    // Bu qism 500 xatosini qaysi qatorda ekanini ko'rsatadi
    this.logger.error(
      `Method: ${request.method} | URL: ${request.url}`,
      exception instanceof Error ? exception.stack : JSON.stringify(exception)
    );

    // 4. Foydalanuvchiga qaytarish
    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toLocaleString('sv-SE'),
      path: request.url,
      // Agar bu TypeORM xatosi bo'lsa, uning detallarini ham chiqaramiz
      error: exception.name || 'Error',
      message: message,
    });
  }
}