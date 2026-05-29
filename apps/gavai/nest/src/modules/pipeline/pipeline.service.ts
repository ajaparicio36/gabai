import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { ERROR_CODES } from '@gavai/platform';
import { isCategorySearchUrl } from '@gavai/pipeline';
import { PipelineRepository } from './pipeline.repository';
import { BrightDataService } from './services/brightdata.service';

@Injectable()
export class PipelineService {
  constructor(
    private readonly pipelineRepository: PipelineRepository,
    private readonly brightdata: BrightDataService,
    @InjectQueue('scraping') private readonly scrapingQueue: Queue,
    @InjectQueue('normalization') private readonly normalizationQueue: Queue,
    @InjectQueue('enrichment') private readonly enrichmentQueue: Queue,
    @InjectQueue('crawling') private readonly crawlingQueue: Queue,
  ) {}

  async discover(
    location: string,
    propertyType?: string,
  ): Promise<{
    discovered: number;
    duplicatesSkipped: number;
    categorySkipped: number;
  }> {
    const logger = new Logger(PipelineService.name);

    const PORTAL_SITES = [
      'lamudi.com.ph',
      'hoppler.com.ph',
      'dotproperty.com.ph',
      'presello.com',
      'onepropertee.com',
    ];

    const typePhrase = propertyType
      ? `${propertyType.replace(/_/g, ' ')} `
      : '';
    const queries = PORTAL_SITES.map(
      (site) => `site:${site} ${typePhrase}for sale ${location} Philippines`,
    );

    const allUrls: string[] = [];
    for (const query of queries) {
      try {
        const res = await this.brightdata.discover({ query, limit: 20 });
        allUrls.push(...res.urls);
      } catch {
        // Log and continue — partial results are better than none
      }
    }

    // Deduplicate across all portal queries before DB check
    const uniqueUrls = [...new Set(allUrls)];

    let categorySkipped = 0;
    const newTargets = [];
    for (const url of uniqueUrls) {
      if (isCategorySearchUrl(url)) {
        categorySkipped++;
        logger.debug(`Skipping category/search URL: ${url}`);
        continue;
      }

      const urlHash = this.pipelineRepository.computeUrlHash(url);
      const exists = await this.pipelineRepository.findTargetByUrlHash(urlHash);
      if (!exists) {
        newTargets.push({
          url,
          urlHash,
          status: 'pending_review',
          location,
          propertyType: propertyType ?? 'unknown',
        });
      }
    }

    await this.pipelineRepository.createScrapingTargets(newTargets);
    return {
      discovered: newTargets.length,
      duplicatesSkipped:
        uniqueUrls.length - newTargets.length - categorySkipped,
      categorySkipped,
    };
  }

  async approveDiscoverTargets(ids: string[]): Promise<{ approved: number }> {
    const result = await this.pipelineRepository.approveTargets(ids);
    return { approved: result.count };
  }

  async runScrape(): Promise<{ queued: number }> {
    const targets = await this.pipelineRepository.findQueuedTargets();
    for (const target of targets) {
      await this.pipelineRepository.updateTargetStatus(target.id, {
        status: 'scraping',
      });
      await this.scrapingQueue.add('scrape-url', {
        targetId: target.id,
        url: target.url,
        propertyType: target.propertyType ?? 'unknown',
      });
    }
    return { queued: targets.length };
  }

  async queueNormalizationForRecords(
    ids: string[],
  ): Promise<{ queued: number }> {
    for (const id of ids) {
      await this.normalizationQueue.add('normalize-record', { recordId: id });
    }
    return { queued: ids.length };
  }

  async getNormalizationRecords() {
    return this.pipelineRepository.findNormalizationReviewRecords();
  }

  async approveNormalizedRecords(ids: string[]): Promise<{ approved: number }> {
    const result = await this.pipelineRepository.approveNormalizedRecords(ids);
    for (const id of ids) {
      const record = await this.pipelineRepository.findRecordById(id);
      if (record?.status === 'approved') {
        await this.enrichmentQueue.add('enrich-record', {
          recordId: record.id,
        });
      }
    }
    return { approved: result.count };
  }

  async rejectNormalizationRecords(
    ids: string[],
  ): Promise<{ rejected: number }> {
    const result =
      await this.pipelineRepository.rejectNormalizationRecords(ids);
    return { rejected: result.count };
  }

  async approveScrapeRecords(ids: string[]): Promise<{ approved: number }> {
    const result = await this.pipelineRepository.approveRecords(ids);
    return { approved: result.count };
  }

  async rejectScrapeRecords(ids: string[]): Promise<{ rejected: number }> {
    const result = await this.pipelineRepository.rejectRecords(ids);
    return { rejected: result.count };
  }

  async getPendingTargets() {
    return this.pipelineRepository.findPendingReviewTargets();
  }

  async getPendingRecords() {
    return this.pipelineRepository.findPendingReviewRecords();
  }

  async getScrapingJobs() {
    return this.pipelineRepository.findScrapingJobs();
  }

  async getQueueStatus(): Promise<{
    scraping: { active: number; waiting: number };
    normalization: { active: number; waiting: number };
    enrichment: { active: number; waiting: number };
    crawling: { active: number; waiting: number };
  }> {
    const [
      scrapingActive,
      scrapingWaiting,
      normalizationActive,
      normalizationWaiting,
      enrichmentActive,
      enrichmentWaiting,
      crawlingActive,
      crawlingWaiting,
    ] = await Promise.all([
      this.scrapingQueue.getActiveCount(),
      this.scrapingQueue.getWaitingCount(),
      this.normalizationQueue.getActiveCount(),
      this.normalizationQueue.getWaitingCount(),
      this.enrichmentQueue.getActiveCount(),
      this.enrichmentQueue.getWaitingCount(),
      this.crawlingQueue.getActiveCount(),
      this.crawlingQueue.getWaitingCount(),
    ]);
    return {
      scraping: { active: scrapingActive, waiting: scrapingWaiting },
      normalization: {
        active: normalizationActive,
        waiting: normalizationWaiting,
      },
      enrichment: { active: enrichmentActive, waiting: enrichmentWaiting },
      crawling: { active: crawlingActive, waiting: crawlingWaiting },
    };
  }

  async getRecordById(id: string) {
    const record = await this.pipelineRepository.findRecordById(id);
    if (!record) {
      throw new BadRequestException({
        code: ERROR_CODES.NOT_FOUND.SCRAPING_TARGET,
        message: 'Record not found',
      });
    }
    return record;
  }

  async editRecord(id: string, data: Record<string, unknown>) {
    return this.pipelineRepository.updateRecord(id, data);
  }

  async createCrawlSeed(data: {
    url: string;
    site: string;
    propertyType?: string;
    maxPages?: number;
    requestDelayMs?: number;
    enabled?: boolean;
  }) {
    return this.pipelineRepository.createCrawlSeed(data);
  }

  async getCrawlSeeds(filter?: { enabled?: boolean; site?: string }) {
    return this.pipelineRepository.findCrawlSeeds(filter);
  }

  async getCrawlSeedById(id: string) {
    const seed = await this.pipelineRepository.findCrawlSeedById(id);
    if (!seed) {
      throw new BadRequestException({
        code: ERROR_CODES.CRAWL.SEED_NOT_FOUND,
        message: 'Crawl seed not found',
      });
    }
    return seed;
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
    const seed = await this.pipelineRepository.findCrawlSeedById(id);
    if (!seed) {
      throw new BadRequestException({
        code: ERROR_CODES.CRAWL.SEED_NOT_FOUND,
        message: 'Crawl seed not found',
      });
    }
    return this.pipelineRepository.updateCrawlSeed(id, data);
  }

  async deleteCrawlSeed(id: string) {
    const seed = await this.pipelineRepository.findCrawlSeedById(id);
    if (!seed) {
      throw new BadRequestException({
        code: ERROR_CODES.CRAWL.SEED_NOT_FOUND,
        message: 'Crawl seed not found',
      });
    }
    return this.pipelineRepository.deleteCrawlSeed(id);
  }

  async runCrawl(
    seedIds: string[],
    options?: { maxPages?: number; requestDelayMs?: number },
  ): Promise<{ queued: number }> {
    for (const seedId of seedIds) {
      const seed = await this.pipelineRepository.findCrawlSeedById(seedId);
      if (!seed) {
        throw new BadRequestException({
          code: ERROR_CODES.CRAWL.SEED_NOT_FOUND,
          message: `Crawl seed not found: ${seedId}`,
        });
      }
      await this.crawlingQueue.add('crawl-seed', {
        seedId: seed.id,
        maxPages: options?.maxPages,
        requestDelayMs: options?.requestDelayMs,
      });
    }
    return { queued: seedIds.length };
  }

  async getCrawlJobs(limit = 20) {
    return this.pipelineRepository.findCrawlJobs(limit);
  }

  async getCrawlJobById(id: string) {
    const job = await this.pipelineRepository.findCrawlJobById(id);
    if (!job) {
      throw new BadRequestException({
        code: ERROR_CODES.CRAWL.JOB_NOT_FOUND,
        message: 'Crawl job not found',
      });
    }
    return job;
  }

  async autoScrapeCrawledTargets(): Promise<{ queued: number }> {
    const targets = await this.pipelineRepository.findQueuedTargets();
    if (targets.length === 0) return { queued: 0 };

    for (const target of targets) {
      await this.pipelineRepository.updateTargetStatus(target.id, {
        status: 'scraping',
      });
      await this.scrapingQueue.add('scrape-url', {
        targetId: target.id,
        url: target.url,
        propertyType: target.propertyType ?? 'unknown',
      });
    }

    return { queued: targets.length };
  }
}
