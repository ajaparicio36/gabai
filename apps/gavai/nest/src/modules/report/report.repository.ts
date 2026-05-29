import { Injectable } from '@nestjs/common';
import { PrismaService } from '@gavai/platform';

interface ReportRecord {
  id: string;
  valuationId: string;
  pdfUrl: string | null;
  verificationHash: string;
  createdAt: Date;
}

@Injectable()
export class ReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    valuationId: string,
    pdfUrl: string | null,
    verificationHash: string,
  ): Promise<ReportRecord> {
    return this.prisma.report.create({
      data: {
        valuationId,
        pdfUrl,
        verificationHash,
      },
    }) as Promise<ReportRecord>;
  }

  async findById(id: string): Promise<ReportRecord | null> {
    return this.prisma.report.findUnique({
      where: { id },
    }) as Promise<ReportRecord | null>;
  }

  async findByValuationId(valuationId: string): Promise<ReportRecord | null> {
    return this.prisma.report.findUnique({
      where: { valuationId },
    }) as Promise<ReportRecord | null>;
  }

  async findNormalizedComparablesForValuation(input: {
    lat: number;
    lng: number;
    propertyType: string;
    radiusM: number;
  }) {
    return this.prisma.$queryRaw<
      {
        id: string;
        title: string | null;
        city: string | null;
        province: string | null;
        askingPricePhp: number;
        pricePerSqmPhp: number | null;
        lotAreaSqm: number | null;
        floorAreaSqm: number | null;
        normalizationConfidenceScore: number | null;
        distanceM: number;
      }[]
    >`
      SELECT
        p.id,
        p."rawTitle" AS title,
        p.city,
        p.province,
        p."askingPricePhp",
        p."pricePerSqmPhp",
        p."lotAreaSqm",
        p."floorAreaSqm",
        p."normalizationConfidenceScore",
        ST_Distance(
          ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography
        ) AS "distanceM"
      FROM "Property" p
      JOIN "PendingTrainingRecord" r ON r.id = p."sourceRecordId"
      WHERE ST_DWithin(
        ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
        ${input.radiusM}
      )
      AND p."approved" = true
      AND p."listingType" = 'standard'
      AND p."propertyType" = ${input.propertyType}
      AND r."normalizationStatus" = 'normalized'
      AND r."trainingEligible" = true
      ORDER BY "distanceM" ASC
      LIMIT 10
    `;
  }
}
