import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  data: T;
  statusCode: number;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => ({
        // TUZATISH 1: success field qo'shildi —
        // frontend statusCode o'rniga success: true/false tekshiradi
        success: response.statusCode < 400,
        data,
        statusCode: response.statusCode,
        // TUZATISH 2: formatDate o'rniga toLocaleString —
        // server Toshkent vaqtida ishlaydi, UTC emas
        timestamp: new Date().toLocaleString('sv-SE', {
          timeZone: 'Asia/Tashkent',
        }),
      })),
    );
  }
}
