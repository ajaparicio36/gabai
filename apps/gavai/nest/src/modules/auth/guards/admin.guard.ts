import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ERROR_CODES } from '@gavai/platform';
import type { JwtPayload } from '../types/auth.types';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user: JwtPayload }>();

    if (!request.user || request.user.role !== 'admin') {
      throw new ForbiddenException({
        code: ERROR_CODES.AUTH.FORBIDDEN,
        message: 'Admin access required',
      });
    }

    return true;
  }
}
