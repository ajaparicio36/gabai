import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import {
  HeatmapService,
  GeoJsonTileResponse,
  QuickEstimateResult,
} from './heatmap.service';

@Controller('heatmap')
@UseGuards(JwtAuthGuard)
export class HeatmapController {
  constructor(private readonly heatmapService: HeatmapService) {}

  @Get('tiles')
  async getTiles(
    @Query('bbox') bbox: string,
    @Query('propertyType') propertyType?: string,
  ): Promise<GeoJsonTileResponse> {
    return this.heatmapService.getTiles(bbox, propertyType);
  }

  @Get('estimate')
  async getQuickEstimate(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ): Promise<QuickEstimateResult> {
    return this.heatmapService.getQuickEstimate(Number(lat), Number(lng));
  }
}
