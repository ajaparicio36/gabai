import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import type { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const { method, originalUrl } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = ctx.getResponse<Response>();
        const duration = Date.now() - startTime;
        this.logger.log(
          `${response.statusCode} ${method} ${originalUrl} ${duration}ms`,
        );
      }),
      catchError((error: Error) => {
        const duration = Date.now() - startTime;
        this.logger.error(
          `ERROR ${method} ${originalUrl} ${duration}ms - ${error.message}`,
          error.stack,
        );
        throw error;
      }),
    );
  }
}
