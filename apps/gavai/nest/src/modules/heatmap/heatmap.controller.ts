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
    @Query('priceMin') priceMin?: string,
    @Query('priceMax') priceMax?: string,
  ): Promise<GeoJsonTileResponse> {
    return this.heatmapService.getTiles(
      bbox,
      propertyType,
      priceMin != null ? Number(priceMin) : undefined,
      priceMax != null ? Number(priceMax) : undefined,
    );
  }

  @Get('estimate')
  async getQuickEstimate(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ): Promise<QuickEstimateResult> {
    return this.heatmapService.getQuickEstimate(Number(lat), Number(lng));
  }

  @Get('estimate/all-types')
  async getAllTypeEstimates(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ): Promise<Record<string, QuickEstimateResult>> {
    return this.heatmapService.getAllTypeEstimates(Number(lat), Number(lng));
  }

  @Get('properties')
  async getProperties(
    @Query('minLat') minLat: string,
    @Query('minLng') minLng: string,
    @Query('maxLat') maxLat: string,
    @Query('maxLng') maxLng: string,
    @Query('propertyType') propertyType?: string,
    @Query('priceMin') priceMin?: string,
    @Query('priceMax') priceMax?: string,
  ): Promise<NearbyProperty[]> {
    return this.heatmapService.getNearbyProperties(
      Number(minLat),
      Number(minLng),
      Number(maxLat),
      Number(maxLng),
      propertyType || undefined,
      priceMin != null ? Number(priceMin) : undefined,
      priceMax != null ? Number(priceMax) : undefined,
    );
  }

  @Get('comparables')
  async getComparables(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
    @Query('propertyType') propertyType?: string,
  ): Promise<NearbyProperty[]> {
    return this.heatmapService.getComparables(
      Number(lat),
      Number(lng),
      radius ? Number(radius) : undefined,
      propertyType,
    );
  }
}
