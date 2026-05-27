import { Injectable } from '@nestjs/common';
import { PrismaService } from '@gabai/platform';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createUser(email: string, passwordHash: string) {
    return this.prisma.user.create({
      data: { email, passwordHash },
    });
  }

  async createRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
    return this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  async findRefreshTokenByHash(tokenHash: string) {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  async revokeRefreshToken(id: string) {
    return this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserRefreshTokens(userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async findApiKeyByHash(keyHash: string) {
    return this.prisma.apiKey.findUnique({ where: { keyHash } });
  }

  async findApiKeysByUser(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        keyPrefix: true,
        tier: true,
        rateLimit: true,
        revokedAt: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
  }

  async createApiKey(
    userId: string,
    keyHash: string,
    keyPrefix: string,
    tier: string,
    rateLimit: number,
  ) {
    return this.prisma.apiKey.create({
      data: { userId, keyHash, keyPrefix, tier, rateLimit },
    });
  }

  async updateApiKey(id: string, data: { keyHash: string; keyPrefix: string }) {
    return this.prisma.apiKey.update({ where: { id }, data });
  }

  async findApiKeyById(id: string) {
    return this.prisma.apiKey.findUnique({ where: { id } });
  }

  async revokeApiKey(id: string) {
    return this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }
}
