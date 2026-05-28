import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { ERROR_CODES } from '@gavai/platform';
import { AuthRepository } from './auth.repository';
import type { JwtPayload, TokenPair } from './types/auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  async signup(
    email: string,
    password: string,
  ): Promise<{ id: string; email: string }> {
    const existing = await this.authRepository.findUserByEmail(email);
    if (existing) {
      throw new ConflictException({
        code: ERROR_CODES.AUTH.EMAIL_TAKEN,
        message: 'Email is already registered',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.authRepository.createUser(email, passwordHash);

    return { id: user.id, email: user.email };
  }

  async login(
    email: string,
    password: string,
  ): Promise<
    TokenPair & {
      user: { id: string; email: string; role: string; tier: string };
    }
  > {
    const user = await this.authRepository.findUserByEmail(email);
    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
      tier: user.tier,
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tier: user.tier,
      },
    };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.authRepository.findRefreshTokenByHash(tokenHash);

    if (!stored) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH.TOKEN_INVALID,
        message: 'Invalid refresh token',
      });
    }

    if (stored.revokedAt) {
      await this.authRepository.revokeAllUserRefreshTokens(stored.userId);
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH.TOKEN_REUSE_DETECTED,
        message: 'Token reuse detected — all sessions revoked',
      });
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH.TOKEN_EXPIRED,
        message: 'Refresh token has expired',
      });
    }

    await this.authRepository.revokeRefreshToken(stored.id);

    const user = await this.authRepository.findUserById(stored.userId);
    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH.TOKEN_INVALID,
        message: 'User no longer exists',
      });
    }

    return this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
      tier: user.tier,
    });
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.authRepository.findRefreshTokenByHash(tokenHash);

    if (stored && !stored.revokedAt) {
      await this.authRepository.revokeRefreshToken(stored.id);
    }
  }

  async createApiKey(
    userId: string,
    tier: string,
    rateLimit: number,
  ): Promise<{ rawKey: string; id: string; prefix: string }> {
    const rawKey = `gavai_sk_${crypto.randomBytes(16).toString('hex')}`;
    const keyHash = this.hashToken(rawKey);
    const keyPrefix = `gavai_sk_${rawKey.slice(8, 16)}`;

    const apiKey = await this.authRepository.createApiKey(
      userId,
      keyHash,
      keyPrefix,
      tier,
      rateLimit,
    );

    return { rawKey, id: apiKey.id, prefix: keyPrefix };
  }

  async rotateApiKey(
    keyId: string,
  ): Promise<{ rawKey: string; prefix: string }> {
    const apiKey = await this.authRepository.findApiKeyById(keyId);
    if (!apiKey) {
      throw new BadRequestException({
        code: ERROR_CODES.NOT_FOUND.API_KEY_ID,
        message: 'API key not found',
      });
    }

    const rawKey = `gavai_sk_${crypto.randomBytes(16).toString('hex')}`;
    const keyHash = this.hashToken(rawKey);
    const keyPrefix = `gavai_sk_${rawKey.slice(8, 16)}`;

    await this.authRepository.updateApiKey(keyId, { keyHash, keyPrefix });

    return { rawKey, prefix: keyPrefix };
  }

  async listApiKeys(userId: string) {
    return this.authRepository.findApiKeysByUser(userId);
  }

  async revokeApiKey(keyId: string): Promise<void> {
    const apiKey = await this.authRepository.findApiKeyById(keyId);
    if (!apiKey) {
      throw new BadRequestException({
        code: ERROR_CODES.NOT_FOUND.API_KEY_ID,
        message: 'API key not found',
      });
    }

    await this.authRepository.revokeApiKey(keyId);
  }

  async findUserById(id: string) {
    return this.authRepository.findUserById(id);
  }

  private async generateTokens(payload: JwtPayload): Promise<TokenPair> {
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });

    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = this.hashToken(refreshToken);

    await this.authRepository.createRefreshToken(
      payload.sub,
      refreshTokenHash,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    );

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
