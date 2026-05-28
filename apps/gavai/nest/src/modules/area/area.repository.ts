import { Injectable } from '@nestjs/common';
import { PrismaService, Prisma } from '@gavai/platform';

interface CachedAreaIntel {
  id: string;
  latKey: number;
  lngKey: number;
  radiusM: number;
  bulletPoints: string[];
  sourceArticles: unknown;
  fetchedAt: Date;
  expiresAt: Date;
}

@Injectable()
export class AreaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCached(
    latKey: number,
    lngKey: number,
    radiusM: number,
  ): Promise<CachedAreaIntel | null> {
    const result = await this.prisma.areaIntelligence.findFirst({
      where: {
        latKey,
        lngKey,
        radiusM,
        expiresAt: { gt: new Date() },
      },
    });
    return result as CachedAreaIntel | null;
  }

  async findExpired(
    latKey: number,
    lngKey: number,
    radiusM: number,
  ): Promise<CachedAreaIntel | null> {
    const result = await this.prisma.areaIntelligence.findFirst({
      where: {
        latKey,
        lngKey,
        radiusM,
        expiresAt: { lt: new Date() },
      },
      orderBy: { fetchedAt: 'desc' },
    });
    return result as CachedAreaIntel | null;
  }

  async upsertCache(
    latKey: number,
    lngKey: number,
    radiusM: number,
    bulletPoints: string[],
    sourceArticles: Prisma.InputJsonValue,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.areaIntelligence.upsert({
      where: {
        latKey_lngKey_radiusM: {
          latKey,
          lngKey,
          radiusM,
        },
      },
      update: {
        bulletPoints,
        sourceArticles,
        fetchedAt: new Date(),
        expiresAt,
      },
      create: {
        latKey,
        lngKey,
        radiusM,
        bulletPoints,
        sourceArticles,
        fetchedAt: new Date(),
        expiresAt,
      },
    });
  }
}
