import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { HeatmapService } from './heatmap.service';
import {
  GeoJsonTileResponse,
  QuickEstimateResult,
  NearbyProperty,
} from './heatmap.repository';

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

  @Get('properties')
  async getProperties(
    @Query('minLat') minLat: string,
    @Query('minLng') minLng: string,
    @Query('maxLat') maxLat: string,
    @Query('maxLng') maxLng: string,
    @Query('propertyType') propertyType?: string,
  ): Promise<NearbyProperty[]> {
    return this.heatmapService.getNearbyProperties(
      Number(minLat),
      Number(minLng),
      Number(maxLat),
      Number(maxLng),
      propertyType || undefined,
    );
  }
}
