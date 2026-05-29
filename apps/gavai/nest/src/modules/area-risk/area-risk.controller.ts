import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { AreaRiskService } from './area-risk.service';
import type { RiskAssessmentResult } from './types/risk.types';

@Controller('area')
@UseGuards(JwtAuthGuard)
export class AreaRiskController {
  constructor(private readonly areaRiskService: AreaRiskService) {}

  @Get('risk-assessment')
  async getRiskAssessment(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
  ): Promise<RiskAssessmentResult> {
    return this.areaRiskService.getRiskAssessment(lat, lng);
  }
}
