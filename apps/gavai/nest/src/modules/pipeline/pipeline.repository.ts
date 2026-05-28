import { Injectable } from '@nestjs/common';
import { PrismaService } from '@gavai/platform';
import { createHash } from 'crypto';

@Injectable()
export class PipelineRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPendingReviewTargets() {
    return this.prisma.scrapingTarget.findMany({
      where: { status: 'pending_review' },
    });
  }

  async findQueuedTargets() {
    return this.prisma.scrapingTarget.findMany({ where: { status: 'queued' } });
  }

  async findTargetByUrlHash(urlHash: string) {
    return this.prisma.scrapingTarget.findUnique({ where: { urlHash } });
  }

  async createScrapingTargets(
    targets: {
      url: string;
      urlHash: string;
      status: string;
      location: string;
      propertyType?: string;
    }[],
  ) {
    return this.prisma.scrapingTarget.createMany({
      data: targets,
      skipDuplicates: true,
    });
  }

  async updateTargetStatus(
    id: string,
    data: {
      status: string;
      scrapedAt?: Date;
      recordCount?: number;
      errorLog?: string;
    },
  ) {
    return this.prisma.scrapingTarget.update({ where: { id }, data });
  }

  async approveTargets(ids: string[]) {
    return this.prisma.scrapingTarget.updateMany({
      where: { id: { in: ids }, status: 'pending_review' },
      data: { status: 'queued' },
    });
  }

  async setTargetStatusBulk(ids: string[], status: string) {
    return this.prisma.scrapingTarget.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });
  }

  async createPendingRecord(data: {
    status: string;
    sourceUrl?: string;
    title?: string;
    addressRaw?: string;
    city?: string;
    barangay?: string;
    propertyType?: string;
    lotAreaSqm?: number;
    floorAreaSqm?: number;
    bedrooms?: number;
    bathrooms?: number;
    askingPricePhp?: number;
    pricePerSqmPhp?: number;
    listingDate?: Date;
    developer?: string;
    flagged?: boolean;
    flagReason?: string;
  }) {
    return this.prisma.pendingTrainingRecord.create({ data });
  }

  async findPendingReviewRecords() {
    return this.prisma.pendingTrainingRecord.findMany({
      where: { status: 'pending_review' },
    });
  }

  async approveRecords(ids: string[]) {
    return this.prisma.pendingTrainingRecord.updateMany({
      where: { id: { in: ids }, status: 'pending_review' },
      data: { status: 'approved' },
    });
  }

  async rejectRecords(ids: string[]) {
    return this.prisma.pendingTrainingRecord.updateMany({
      where: { id: { in: ids } },
      data: { status: 'rejected' },
    });
  }

  async findRecordById(id: string) {
    return this.prisma.pendingTrainingRecord.findUnique({ where: { id } });
  }

  async updateRecord(id: string, data: Record<string, unknown>) {
    return this.prisma.pendingTrainingRecord.update({ where: { id }, data });
  }

  async createScrapingJob(source: string) {
    return this.prisma.scrapingJob.create({
      data: { source, status: 'queued' },
    });
  }

  async updateScrapingJob(
    id: string,
    data: {
      status?: string;
      startedAt?: Date;
      completedAt?: Date;
      recordCount?: number;
      errorLog?: string;
    },
  ) {
    return this.prisma.scrapingJob.update({ where: { id }, data });
  }

  async findScrapingJobs() {
    return this.prisma.scrapingJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async createProperty(data: {
    sourceUrl?: string;
    scrapedAt: Date;
    rawTitle?: string;
    addressRaw?: string;
    googlePlaceId?: string;
    city?: string;
    barangay?: string;
    lat?: number;
    lng?: number;
    propertyType: string;
    listingType?: string;
    lotAreaSqm?: number;
    floorAreaSqm?: number;
    bedrooms?: number;
    bathrooms?: number;
    buildingAgeYears?: number;
    developer?: string;
    askingPricePhp: number;
    pricePerSqmPhp?: number;
    listingDate?: Date;
    zonalValuePhp?: number;
    landClassification?: string;
    proximityScores?: Record<string, number>;
    phivolcsRisk?: number;
    floodRisk?: number;
    crepTier?: string;
    crepPhp?: number;
    approved: boolean;
  }) {
    return this.prisma.property.create({ data });
  }

  async findApprovedPropertiesByType(propertyType: string) {
    return this.prisma.property.findMany({
      where: { propertyType, approved: true },
    });
  }

  async findGovernmentReference(barangay: string, city: string) {
    return this.prisma.governmentReference.findUnique({
      where: { barangay_city: { barangay, city } },
    });
  }

  async upsertGovernmentReference(data: {
    barangay: string;
    city: string;
    zonalValuePhp?: number;
    landClassification?: string;
    phivolcsRisk?: number;
    floodRisk?: number;
    barangayMultiplier?: number;
    priceTrend6m?: number;
  }) {
    return this.prisma.governmentReference.upsert({
      where: { barangay_city: { barangay: data.barangay, city: data.city } },
      update: data,
      create: data,
    });
  }

  async findNearbyApprovedProperty(lat: number, lng: number, radiusM: number) {
    return this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Property"
      WHERE ST_DWithin(
        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radiusM}
      )
      AND "approved" = true
      LIMIT 1
    `;
  }

  computeUrlHash(url: string): string {
    return createHash('sha256').update(url).digest('hex');
  }
}
