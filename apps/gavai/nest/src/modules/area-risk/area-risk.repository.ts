import { Injectable } from '@nestjs/common';
import { PrismaService, Prisma } from '@gavai/platform';
import type { RiskAssessmentResult } from './types/risk.types';

@Injectable()
export class AreaRiskRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCached(
    latKey: number,
    lngKey: number,
  ): Promise<RiskAssessmentResult | null> {
    const record = await this.prisma.areaRiskScores.findUnique({
      where: { latKey_lngKey: { latKey, lngKey } },
    });

    if (!record || record.expiresAt <= new Date()) return null;

    return this.recordToResult(record);
  }

  async upsert(
    latKey: number,
    lngKey: number,
    result: RiskAssessmentResult,
    ttlHours = 24,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    await this.prisma.areaRiskScores.upsert({
      where: { latKey_lngKey: { latKey, lngKey } },
      update: {
        floodScore: result.scores.flood,
        floodLevel: result.metadata.flood?.level ?? null,
        trafficScore: result.scores.traffic,
        trafficSpeedRatio: result.metadata.traffic?.speedRatio ?? null,
        yieldScore: result.scores.yield,
        yieldArticleCount: result.metadata.yield?.articleCount ?? null,
        marketPremium: result.scores.marketPremium,
        faultScore: result.scores.fault,
        metadata: result.metadata as unknown as Prisma.InputJsonValue,
        fetchedAt: new Date(),
        expiresAt,
      },
      create: {
        latKey,
        lngKey,
        floodScore: result.scores.flood,
        floodLevel: result.metadata.flood?.level ?? null,
        trafficScore: result.scores.traffic,
        trafficSpeedRatio: result.metadata.traffic?.speedRatio ?? null,
        yieldScore: result.scores.yield,
        yieldArticleCount: result.metadata.yield?.articleCount ?? null,
        marketPremium: result.scores.marketPremium,
        faultScore: result.scores.fault,
        metadata: result.metadata as unknown as Prisma.InputJsonValue,
        expiresAt,
      },
    });
  }

  private recordToResult(record: {
    floodScore: number | null;
    floodLevel: string | null;
    trafficScore: number | null;
    trafficSpeedRatio: number | null;
    yieldScore: number | null;
    yieldArticleCount: number | null;
    marketPremium: number | null;
    faultScore: number | null;
    metadata: unknown;
  }): RiskAssessmentResult {
    const meta = (record.metadata as Record<string, unknown>) ?? {};

    const floodMeta = meta.flood as Record<string, string> | undefined;
    const trafficMeta = meta.traffic as Record<string, unknown> | undefined;
    const yieldMeta = meta.yield as Record<string, unknown> | undefined;
    const marketMeta = meta.marketPremium as Record<string, number> | undefined;

    return {
      scores: {
        flood: record.floodScore,
        traffic: record.trafficScore,
        yield: record.yieldScore,
        marketPremium: record.marketPremium,
        fault: record.faultScore ?? 0.5,
      },
      metadata: {
        flood: floodMeta
          ? {
              level: (floodMeta.level as string) ?? 'unknown',
              source: (floodMeta.source as string) ?? 'Project NOAH',
              returnPeriod: (floodMeta.returnPeriod as string) ?? '100yr',
            }
          : null,
        traffic: trafficMeta
          ? {
              speedRatio: (trafficMeta.speedRatio as number) ?? 0,
              cachedAt:
                (trafficMeta.cachedAt as string) ?? new Date().toISOString(),
            }
          : null,
        yield: yieldMeta
          ? {
              articleCount: (yieldMeta.articleCount as number) ?? 0,
              positiveRatio: (yieldMeta.positiveRatio as number) ?? 0,
            }
          : null,
        marketPremium: marketMeta
          ? {
              avmPerSqm: (marketMeta.avmPerSqm as number) ?? 0,
              zonalPerSqm: (marketMeta.zonalPerSqm as number) ?? 0,
              ratio: (marketMeta.ratio as number) ?? 0,
            }
          : null,
        fault: {
          status:
            (meta.fault as Record<string, string>)?.status ?? 'placeholder',
        },
      },
    };
  }
}
