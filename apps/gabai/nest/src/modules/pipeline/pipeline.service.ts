import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { ERROR_CODES } from '@gabai/platform';
import { PipelineRepository } from './pipeline.repository';
import { BrightDataService } from './services/brightdata.service';

@Injectable()
export class PipelineService {
  constructor(
    private readonly pipelineRepository: PipelineRepository,
    private readonly brightdata: BrightDataService,
    @InjectQueue('scraping') private readonly scrapingQueue: Queue,
    @InjectQueue('enrichment') private readonly enrichmentQueue: Queue,
  ) {}

  async discover(
    location: string,
    propertyType?: string,
  ): Promise<{ discovered: number; duplicatesSkipped: number }> {
    const query =
      `property for sale ${propertyType ?? ''} ${location} Philippines`.trim();
    const res = await this.brightdata.discover({ query, limit: 30 });

    const newTargets = [];
    for (const url of res.urls) {
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
      duplicatesSkipped: res.urls.length - newTargets.length,
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

  async approveScrapeRecords(ids: string[]): Promise<{ approved: number }> {
    const result = await this.pipelineRepository.approveRecords(ids);

    for (const id of ids) {
      const record = await this.pipelineRepository.findRecordById(id);
      if (record && record.status === 'approved') {
        await this.enrichmentQueue.add('enrich-record', {
          recordId: record.id,
        });
      }
    }

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
}
