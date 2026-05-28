import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Response } from 'express';
import { ApiErrorDto, ERROR_CODES } from '@gavai/platform';

@Catch()
export class GlobalExceptionFilter
  extends BaseExceptionFilter
  implements ExceptionFilter
{
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  override catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      const errorDto: ApiErrorDto =
        typeof exceptionResponse === 'object' && exceptionResponse !== null
          ? this.extractErrorDto(
              status,
              exceptionResponse as Record<string, unknown>,
            )
          : this.fallbackErrorDto(status, String(exceptionResponse));

      response.status(status).json({ data: null, error: errorDto });
      return;
    }

    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      data: null,
      error: {
        code: ERROR_CODES.INTERNAL.UNKNOWN,
        message: 'Internal server error',
      },
    });
  }

  private extractErrorDto(
    status: number,
    exceptionResponse: Record<string, unknown>,
  ): ApiErrorDto {
    if (typeof exceptionResponse.code === 'string') {
      return {
        code: exceptionResponse.code,
        message: String(exceptionResponse.message ?? ''),
        details: exceptionResponse.details as
          | Record<string, unknown>
          | undefined,
      };
    }

    const messages = Array.isArray(exceptionResponse.message)
      ? (exceptionResponse.message as string[]).join('; ')
      : String(exceptionResponse.message ?? '');

    return {
      code: this.statusToErrorCode(status),
      message: messages,
    };
  }

  private fallbackErrorDto(status: number, message: string): ApiErrorDto {
    return {
      code: this.statusToErrorCode(status),
      message,
    };
  }

  private statusToErrorCode(status: number): string {
    switch (status) {
      case 400:
        return ERROR_CODES.VALIDATION.INVALID_INPUT;
      case 401:
        return ERROR_CODES.AUTH.UNAUTHORIZED;
      case 403:
        return ERROR_CODES.AUTH.FORBIDDEN;
      case 404:
        return ERROR_CODES.NOT_FOUND.ROUTE;
      case 429:
        return ERROR_CODES.RATE_LIMIT.EXCEEDED;
      default:
        return ERROR_CODES.INTERNAL.UNKNOWN;
    }
  }
}
