import { Injectable } from '@nestjs/common';
import { roundToGrid } from '@gavai/pipeline';
import { AreaRiskRepository } from './area-risk.repository';
import { FloodRiskService } from '../area/flood-risk.service';
import { TrafficScoreService } from '../area/traffic-score.service';
import { YieldScoreService } from '../area/yield-score.service';
import { MarketPremiumService } from '../area/market-premium.service';
import type { RiskAssessmentResult } from './types/risk.types';

@Injectable()
export class AreaRiskService {
  constructor(
    private readonly repository: AreaRiskRepository,
    private readonly floodRiskService: FloodRiskService,
    private readonly trafficScoreService: TrafficScoreService,
    private readonly yieldScoreService: YieldScoreService,
    private readonly marketPremiumService: MarketPremiumService,
  ) {}

  async getRiskAssessment(
    lat: number,
    lng: number,
  ): Promise<RiskAssessmentResult> {
    const latKey = roundToGrid(lat);
    const lngKey = roundToGrid(lng);

    const cached = await this.repository.findCached(latKey, lngKey);
    if (cached) return cached;

    const [flood, traffic, yieldScore, marketPremium] =
      await Promise.allSettled([
        this.floodRiskService.getScore(lat, lng),
        this.trafficScoreService.getScore(lat, lng),
        this.yieldScoreService.getScore(lat, lng),
        this.marketPremiumService.getScore(lat, lng),
      ]);

    const result: RiskAssessmentResult = {
      scores: {
        flood:
          flood.status === 'fulfilled'
            ? (flood.value as { score: number }).score
            : null,
        traffic:
          traffic.status === 'fulfilled'
            ? (traffic.value as { score: number }).score
            : null,
        yield:
          yieldScore.status === 'fulfilled'
            ? (yieldScore.value as { score: number }).score
            : null,
        marketPremium:
          marketPremium.status === 'fulfilled'
            ? (marketPremium.value as { score: number }).score
            : null,
        fault: 0.5,
      },
      metadata: {
        flood:
          flood.status === 'fulfilled'
            ? {
                level: (flood.value as { level: string }).level ?? 'unknown',
                source:
                  (flood.value as { source: string }).source ??
                  'Project NOAH (DOST)',
                returnPeriod:
                  (flood.value as { returnPeriod: string }).returnPeriod ??
                  '5yr',
                description:
                  '5-year flood hazard from PAGASA/Project NOAH data. Shows areas likely to flood in a 5-year rainfall event.',
              }
            : null,
        traffic:
          traffic.status === 'fulfilled'
            ? {
                delayPercent:
                  (traffic.value as { delayPercent: number }).delayPercent ?? 0,
                cachedAt:
                  (traffic.value as { cachedAt: string }).cachedAt ??
                  new Date().toISOString(),
              }
            : null,
        yield:
          yieldScore.status === 'fulfilled'
            ? {
                articleCount:
                  (yieldScore.value as { articleCount: number }).articleCount ??
                  0,
                positiveRatio:
                  (yieldScore.value as { positiveRatio: number })
                    .positiveRatio ?? 0,
              }
            : null,
        marketPremium:
          marketPremium.status === 'fulfilled'
            ? {
                avmPerSqm:
                  (marketPremium.value as { avmPerSqm: number }).avmPerSqm ?? 0,
                zonalPerSqm:
                  (marketPremium.value as { zonalPerSqm: number })
                    .zonalPerSqm ?? 0,
                ratio: (marketPremium.value as { ratio: number }).ratio ?? 0,
              }
            : null,
        fault: { status: 'placeholder' },
      },
    };

    await this.repository.upsert(latKey, lngKey, result);

    return result;
  }
}
