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
    sourceName?: string;
    title?: string;
    description?: string;
    addressRaw?: string;
    locationRaw?: string;
    city?: string;
    province?: string;
    region?: string;
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
    rawTextReference?: string;
    aiExtraction?: unknown;
    fieldConfidence?: unknown;
    confidenceScore?: number;
    locationStatus?: string;
    normalizationStatus?: string;
    normalizationIssues?: unknown;
    normalizedAt?: Date;
    trainingEligible?: boolean;
    flagged?: boolean;
    flagReason?: string;
  }) {
    return this.prisma.pendingTrainingRecord.create({ data: data as any });
  }

  async updateRecordNormalization(
    id: string,
    data: {
      title?: string | null;
      description?: string | null;
      locationRaw?: string | null;
      city?: string | null;
      province?: string | null;
      region?: string | null;
      propertyType?: string | null;
      askingPricePhp?: number | null;
      lotAreaSqm?: number | null;
      floorAreaSqm?: number | null;
      rawTextReference?: string | null;
      aiExtraction?: unknown;
      fieldConfidence?: unknown;
      confidenceScore?: number;
      locationStatus?: string;
      normalizationStatus: string;
      normalizationIssues?: unknown;
      normalizedAt: Date;
      trainingEligible: boolean;
      status: string;
      flagged?: boolean;
      flagReason?: string | null;
    },
  ) {
    return this.prisma.pendingTrainingRecord.update({
      where: { id },
      data: data as any,
    });
  }

  async findNormalizationReviewRecords() {
    return this.prisma.pendingTrainingRecord.findMany({
      where: {
        normalizationStatus: { in: ['normalized', 'low_confidence', 'failed'] },
        status: { in: ['normalization_review', 'normalization_failed'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async approveNormalizedRecords(ids: string[]) {
    return this.prisma.pendingTrainingRecord.updateMany({
      where: {
        id: { in: ids },
        normalizationStatus: { in: ['normalized', 'low_confidence'] },
        trainingEligible: true,
      },
      data: { status: 'approved' },
    });
  }

  async rejectNormalizationRecords(ids: string[]) {
    return this.prisma.pendingTrainingRecord.updateMany({
      where: {
        id: { in: ids },
        normalizationStatus: { in: ['low_confidence', 'failed'] },
      },
      data: { status: 'rejected' },
    });
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
    sourceRecordId?: string;
    sourceUrl?: string;
    scrapedAt: Date;
    rawTitle?: string;
    addressRaw?: string;
    googlePlaceId?: string;
    city?: string;
    province?: string;
    region?: string;
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
    normalizationConfidenceScore?: number;
    normalizationIssues?: unknown;
    approved: boolean;
  }) {
    return this.prisma.property.create({ data: data as any });
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

  async createCrawlSeed(data: {
    url: string;
    site: string;
    propertyType?: string;
    maxPages?: number;
    requestDelayMs?: number;
    enabled?: boolean;
  }) {
    return this.prisma.crawlSeed.create({ data: data as any });
  }

  async findCrawlSeedById(id: string) {
    return this.prisma.crawlSeed.findUnique({ where: { id } });
  }

  async findCrawlSeeds(filter?: { enabled?: boolean; site?: string }) {
    return this.prisma.crawlSeed.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateCrawlSeed(
    id: string,
    data: {
      url?: string;
      site?: string;
      propertyType?: string;
      maxPages?: number;
      requestDelayMs?: number;
      enabled?: boolean;
    },
  ) {
    return this.prisma.crawlSeed.update({
      where: { id },
      data,
    });
  }

  async deleteCrawlSeed(id: string) {
    return this.prisma.crawlSeed.delete({ where: { id } });
  }

  async createCrawlJob(data: {
    seedId: string;
    status: string;
    startedAt?: Date;
  }) {
    return this.prisma.crawlJob.create({ data: data as any });
  }

  async updateCrawlJob(
    id: string,
    data: {
      status?: string;
      pagesCrawled?: number;
      urlsFound?: number;
      urlsSkipped?: number;
      errorLog?: string;
      completedAt?: Date;
    },
  ) {
    return this.prisma.crawlJob.update({ where: { id }, data });
  }

  async findCrawlJobs(limit = 20) {
    return this.prisma.crawlJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findCrawlJobById(id: string) {
    return this.prisma.crawlJob.findUnique({ where: { id } });
  }

  async findLatestCrawlJobBySeed(seedId: string) {
    return this.prisma.crawlJob.findFirst({
      where: { seedId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
