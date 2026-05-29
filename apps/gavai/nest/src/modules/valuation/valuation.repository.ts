import { Injectable } from '@nestjs/common';
import { PrismaService } from '@gavai/platform';

@Injectable()
export class ValuationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createValuation(data: {
    inputLat?: number;
    inputLng?: number;
    inputAddress?: string;
    propertyType: string;
    lotAreaSqm?: number;
    floorAreaSqm?: number;
    pointEstimatePhp: number;
    confidenceLowPhp: number;
    confidenceHighPhp: number;
    confidenceScore: number;
    dataCompleteness: number;
    comparablesUsed: unknown;
    proximityBreakdown: unknown;
    birCompliance?: unknown;
    modelVersion: string;
    propertyId?: string;
  }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.prisma.valuation.create({ data: data as any });
  }

  async findValuationById(id: string) {
    return this.prisma.valuation.findUnique({ where: { id } });
  }

  async findValuationsByPropertyId(propertyId: string) {
    return this.prisma.valuation.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRecentValuations(limit = 20) {
    return this.prisma.valuation.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async createModelVersion(data: {
    version: string;
    modelPath: string;
    status: string;
    mape?: number;
    trainingRecords?: number;
    jobId?: string;
  }) {
    return this.prisma.modelVersion.create({ data });
  }

  async findModelVersionByVersion(version: string) {
    return this.prisma.modelVersion.findUnique({ where: { version } });
  }

  async findLatestModelVersion(status?: string) {
    return this.prisma.modelVersion.findFirst({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findModelVersions() {
    return this.prisma.modelVersion.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async updateModelVersion(
    id: string,
    data: {
      status?: string;
      mape?: number;
      trainingRecords?: number;
      modelPath?: string;
      deployedAt?: Date;
      jobId?: string;
      errorLog?: string;
    },
  ) {
    return this.prisma.modelVersion.update({ where: { id }, data });
  }

  async getTrainingRecords() {
    return this.prisma.property.findMany({
      where: {
        approved: true,
        listingType: 'standard',
        sourceRecord: {
          normalizationStatus: 'normalized',
          trainingEligible: true,
        },
        OR: [{ lotAreaSqm: { not: null } }, { floorAreaSqm: { not: null } }],
      },
      select: {
        id: true,
        propertyType: true,
        lotAreaSqm: true,
        floorAreaSqm: true,
        bedrooms: true,
        bathrooms: true,
        buildingAgeYears: true,
        askingPricePhp: true,
        pricePerSqmPhp: true,
        barangay: true,
        city: true,
        province: true,
        region: true,
        developer: true,
        phivolcsRisk: true,
        floodRisk: true,
        zonalValuePhp: true,
        crepPhp: true,
        proximityScores: true,
        normalizationConfidenceScore: true,
        createdAt: true,
      },
    });
  }
}
