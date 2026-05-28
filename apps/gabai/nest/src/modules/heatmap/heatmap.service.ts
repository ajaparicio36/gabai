import { Injectable, BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '@gabai/platform';
import {
  HeatmapRepository,
  GeoJsonTileResponse,
  QuickEstimateResult,
} from './heatmap.repository';

@Injectable()
export class HeatmapService {
  constructor(private readonly heatmapRepository: HeatmapRepository) {}

  async getTiles(
    bbox: string,
    propertyType?: string,
  ): Promise<GeoJsonTileResponse> {
    const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);

    if (
      [minLng, minLat, maxLng, maxLat].some(
        (v) => isNaN(v) || v < -180 || v > 180,
      )
    ) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION.INVALID_INPUT,
        message: 'Invalid bbox format. Expected: minLng,minLat,maxLng,maxLat',
      });
    }

    const tiles = await this.heatmapRepository.getTileData(
      minLat,
      minLng,
      maxLat,
      maxLng,
      propertyType,
    );

    if (!tiles.length) {
      throw new BadRequestException({
        code: ERROR_CODES.HEATMAP.NO_DATA,
        message: 'No property data available for this area',
      });
    }

    const allPrices = tiles
      .map((t) => t.avg_price)
      .filter((p): p is number => p != null);
    const priceRange = {
      min: Math.min(...allPrices),
      max: Math.max(...allPrices),
    };

    const features = tiles.map((tile) => {
      const gridSize = 0.005;
      const x1 = minLng + tile.grid_x * gridSize;
      const y1 = minLat + tile.grid_y * gridSize;
      const x2 = x1 + gridSize;
      const y2 = y1 + gridSize;

      const intensity =
        priceRange.max > priceRange.min
          ? ((tile.avg_price ?? 0) - priceRange.min) /
            (priceRange.max - priceRange.min)
          : 0.5;

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [
            [
              [x1, y1],
              [x2, y1],
              [x2, y2],
              [x1, y2],
              [x1, y1],
            ],
          ],
        },
        properties: {
          avgPricePerSqm: Math.round(tile.avg_price ?? 0),
          medianPricePerSqm: Math.round(tile.median_price ?? 0),
          propertyCount: tile.count,
          colorIntensity: Math.round(intensity * 100) / 100,
        },
      };
    });

    return {
      type: 'FeatureCollection',
      features,
      metadata: {
        propertyType: propertyType ?? 'all',
        totalProperties: tiles.reduce((sum, t) => sum + t.count, 0),
        priceRange: {
          min: Math.round(priceRange.min),
          max: Math.round(priceRange.max),
        },
      },
    };
  }

  async getQuickEstimate(
    lat: number,
    lng: number,
  ): Promise<QuickEstimateResult> {
    const estimate = await this.heatmapRepository.getQuickEstimate(lat, lng);

    if (estimate.count === 0) {
      throw new BadRequestException({
        code: ERROR_CODES.HEATMAP.NO_DATA,
        message: 'No comparables found within 3km of this location',
      });
    }

    return {
      lowPhp: Math.round(estimate.low ?? 0),
      medianPhp: Math.round(estimate.median ?? 0),
      highPhp: Math.round(estimate.high ?? 0),
      comparablesCount: estimate.count,
    };
  }
}
