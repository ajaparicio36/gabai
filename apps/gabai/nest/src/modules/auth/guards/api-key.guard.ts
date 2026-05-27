import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ERROR_CODES } from '@gabai/platform';
import { AuthRepository } from '../auth.repository';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly authRepository: AuthRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH.API_KEY_INVALID,
        message: 'API key is required in X-API-Key header',
      });
    }

    const apiKeyRecord = await this.authRepository.findApiKeyByHash(apiKey);

    if (!apiKeyRecord) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH.API_KEY_INVALID,
        message: 'Invalid API key',
      });
    }

    if (apiKeyRecord.revokedAt) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH.API_KEY_REVOKED,
        message: 'API key has been revoked',
      });
    }

    (request as unknown as Record<string, unknown>)['apiKey'] = apiKeyRecord;
    return true;
  }

  private extractApiKey(request: Request): string | null {
    const key = request.headers['x-api-key'] as string | undefined;
    if (key) return key;

    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      if (token.startsWith('gabai_sk_')) {
        return token;
      }
    }

    return null;
  }
}
