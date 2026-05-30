import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PipelineModule } from '../pipeline/pipeline.module';
import { ValuationModule } from '../valuation/valuation.module';
import { AreaController } from './area.controller';
import { AreaService } from './area.service';
import { AreaRepository } from './area.repository';
import { TrafficScoreService } from './traffic-score.service';
import { YieldScoreService } from './yield-score.service';
import { FloodRiskService } from './flood-risk.service';
import { FloodOverlayService } from './flood-overlay.service';
import { MarketPremiumService } from './market-premium.service';

@Module({
  imports: [AuthModule, PipelineModule, ValuationModule],
  controllers: [AreaController],
  providers: [
    AreaService,
    AreaRepository,
    TrafficScoreService,
    YieldScoreService,
    FloodRiskService,
    FloodOverlayService,
    MarketPremiumService,
  ],
  exports: [
    AreaService,
    TrafficScoreService,
    YieldScoreService,
    FloodRiskService,
    FloodOverlayService,
    MarketPremiumService,
  ],
})
export class AreaModule {}
