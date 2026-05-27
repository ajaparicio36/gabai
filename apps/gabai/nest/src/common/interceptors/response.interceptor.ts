import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponseDto } from '@gabai/platform';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponseDto<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponseDto<T>> | Promise<Observable<ApiResponseDto<T>>> {
    return next.handle().pipe(
      map((data: T) => {
        if (
          data &&
          typeof data === 'object' &&
          'data' in (data as object) &&
          'error' in (data as object)
        ) {
          return data as unknown as ApiResponseDto<T>;
        }
        return { data: data ?? null, error: null } as ApiResponseDto<T>;
      }),
    );
  }
}
