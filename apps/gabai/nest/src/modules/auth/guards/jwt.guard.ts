import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ERROR_CODES } from '@gabai/platform';
import type { JwtPayload } from '../types/auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH.UNAUTHORIZED,
        message: 'Access token is required',
      });
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      (request as unknown as Record<string, unknown>)['user'] = payload;
      return true;
    } catch {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH.TOKEN_EXPIRED,
        message: 'Access token is expired or invalid',
      });
    }
  }

  private extractToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.slice(7);
  }
}
