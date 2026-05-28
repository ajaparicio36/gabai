import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

export interface ComparableRow {
  id: string;
  distance_m: number;
  pricePerSqmPhp: number | null;
  propertyType: string;
  barangay: string | null;
  city: string | null;
  lotAreaSqm: number | null;
  floorAreaSqm: number | null;
}

@Injectable()
export class SpatialService {
  constructor(private readonly prisma: PrismaService) {}

  async getComparables(
    lat: number,
    lng: number,
    radiusM: number,
    propertyType: string,
  ): Promise<ComparableRow[]> {
    return this.prisma.$queryRaw<ComparableRow[]>`
      SELECT id, "pricePerSqmPhp", "propertyType", barangay, city,
             "lotAreaSqm", "floorAreaSqm",
             ST_Distance(
               ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
               ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
             ) AS distance_m
      FROM "Property"
      WHERE ST_DWithin(
        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radiusM}
      )
      AND "propertyType" = ${propertyType}::text
      AND "pricePerSqmPhp" IS NOT NULL
      AND "listingType" = 'standard'
      AND "approved" = true
      ORDER BY distance_m ASC
      LIMIT 20
    `;
  }

  async getNeighborhoodMedianPricePerSqm(
    lat: number,
    lng: number,
    radiusM: number,
  ): Promise<number | null> {
    const rows: { median: number | null }[] = await this.prisma.$queryRaw`
      SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "pricePerSqmPhp") AS median
      FROM "Property"
      WHERE ST_DWithin(
        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radiusM}
      )
      AND "pricePerSqmPhp" IS NOT NULL
      AND "listingType" = 'standard'
      AND "approved" = true
    `;
    return rows[0]?.median ?? null;
  }

  async getNearbyListingVelocity(
    lat: number,
    lng: number,
    radiusM: number,
    daysBack = 30,
  ): Promise<number> {
    const rows: { count: bigint }[] = await this.prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "Property"
      WHERE ST_DWithin(
        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radiusM}
      )
      AND "createdAt" >= NOW() - INTERVAL '1 day' * ${daysBack}
    `;
    const total = Number(rows[0]?.count ?? 0);
    return total / (daysBack / 7);
  }

  async getMedianPriceMovement(
    barangay: string,
    city: string,
    daysBack = 90,
  ): Promise<number | null> {
    const recent: { median: number | null }[] = await this.prisma.$queryRaw`
      SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "pricePerSqmPhp") AS median
      FROM "Property"
      WHERE barangay = ${barangay}::text
      AND city = ${city}::text
      AND "pricePerSqmPhp" IS NOT NULL
      AND "listingType" = 'standard'
      AND "approved" = true
      AND "createdAt" >= NOW() - INTERVAL '1 day' * ${daysBack}
    `;
    const older: { median: number | null }[] = await this.prisma.$queryRaw`
      SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "pricePerSqmPhp") AS median
      FROM "Property"
      WHERE barangay = ${barangay}::text
      AND city = ${city}::text
      AND "pricePerSqmPhp" IS NOT NULL
      AND "listingType" = 'standard'
      AND "approved" = true
      AND "createdAt" < NOW() - INTERVAL '1 day' * ${daysBack}
      AND "createdAt" >= NOW() - INTERVAL '1 day' * ${daysBack * 2}
    `;

    const recentMedian = recent[0]?.median;
    const olderMedian = older[0]?.median;
    if (recentMedian == null || olderMedian == null || olderMedian === 0)
      return null;
    return (recentMedian - olderMedian) / olderMedian;
  }
}
