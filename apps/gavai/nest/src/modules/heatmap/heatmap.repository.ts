import { Injectable } from '@nestjs/common';
import { PrismaService, Prisma } from '@gavai/platform';

export interface TileFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    avgPricePerSqm: number;
    medianPricePerSqm: number;
    propertyCount: number;
    colorIntensity: number;
  };
}

export interface GeoJsonTileResponse {
  type: 'FeatureCollection';
  features: TileFeature[];
  metadata: {
    propertyType: string;
    totalProperties: number;
    priceRange: { min: number; max: number };
  };
}

export interface QuickEstimateResult {
  lowPhp: number;
  medianPhp: number;
  highPhp: number;
  comparablesCount: number;
}

export interface NearbyProperty {
  id: string;
  lat: number;
  lng: number;
  propertyType: string;
  askingPricePhp: number;
  pricePerSqmPhp: number | null;
  lotAreaSqm: number | null;
  floorAreaSqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  barangay: string | null;
  city: string | null;
  addressRaw: string | null;
}

@Injectable()
export class HeatmapRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getTileData(
    minLat: number,
    minLng: number,
    maxLat: number,
    maxLng: number,
    propertyType?: string,
  ): Promise<
    {
      grid_x: number;
      grid_y: number;
      avg_price: number | null;
      median_price: number | null;
      count: number;
    }[]
  > {
    const typeFilter = propertyType
      ? `AND "propertyType" = '${propertyType}'`
      : '';

    return this.prisma.$queryRawUnsafe<
      {
        grid_x: number;
        grid_y: number;
        avg_price: number | null;
        median_price: number | null;
        count: number;
      }[]
    >(`
      SELECT
        FLOOR((ST_X(ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geometry) - ${minLng}) / 0.005)::int AS grid_x,
        FLOOR((ST_Y(ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geometry) - ${minLat}) / 0.005)::int AS grid_y,
        AVG("pricePerSqmPhp") AS avg_price,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "pricePerSqmPhp") AS median_price,
        COUNT(*)::int AS count
      FROM "Property"
      WHERE
        lat BETWEEN ${minLat} AND ${maxLat}
        AND lng BETWEEN ${minLng} AND ${maxLng}
        AND "pricePerSqmPhp" IS NOT NULL
        AND "listingType" = 'standard'
        AND "approved" = true
        ${typeFilter}
      GROUP BY grid_x, grid_y
      HAVING COUNT(*) >= 2
      ORDER BY count DESC
    `);
  }

  async getQuickEstimate(
    lat: number,
    lng: number,
    radiusM = 3000,
  ): Promise<{
    low: number | null;
    median: number | null;
    high: number | null;
    count: number;
  }> {
    const rows: {
      p25: number | null;
      p50: number | null;
      p75: number | null;
      count: number;
    }[] = await this.prisma.$queryRawUnsafe(`
      SELECT
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY "pricePerSqmPhp") AS p25,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "pricePerSqmPhp") AS p50,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY "pricePerSqmPhp") AS p75,
        COUNT(*)::int AS count
      FROM "Property"
      WHERE ST_DWithin(
        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radiusM}
      )
      AND "pricePerSqmPhp" IS NOT NULL
      AND "listingType" = 'standard'
      AND "approved" = true
    `);

    return {
      low: rows[0]?.p25 ?? null,
      median: rows[0]?.p50 ?? null,
      high: rows[0]?.p75 ?? null,
      count: rows[0]?.count ?? 0,
    };
  }

  async getNearbyProperties(
    minLat: number,
    minLng: number,
    maxLat: number,
    maxLng: number,
    propertyType?: string,
  ): Promise<NearbyProperty[]> {
    const where: Prisma.PropertyWhereInput = {
      lat: { gte: minLat, lte: maxLat },
      lng: { gte: minLng, lte: maxLng },
      pricePerSqmPhp: { not: null },
      listingType: 'standard',
      approved: true,
    };
    if (propertyType) {
      where.propertyType = propertyType;
    }

    const rows = await this.prisma.property.findMany({
      where,
      select: {
        id: true,
        lat: true,
        lng: true,
        propertyType: true,
        askingPricePhp: true,
        pricePerSqmPhp: true,
        lotAreaSqm: true,
        floorAreaSqm: true,
        bedrooms: true,
        bathrooms: true,
        barangay: true,
        city: true,
        addressRaw: true,
      },
      take: 200,
    });

    return rows as NearbyProperty[];
  }
}
