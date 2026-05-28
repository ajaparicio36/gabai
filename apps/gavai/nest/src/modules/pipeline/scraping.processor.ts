import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import {
  LISTING_SCHEMA,
  applyAutoFlagRules,
  ScrapedRecord,
} from '@gavai/pipeline';
import { PipelineRepository } from './pipeline.repository';
import { BrightDataService } from './services/brightdata.service';

@Processor('scraping')
@Injectable()
export class ScrapingProcessor {
  private readonly logger = new Logger(ScrapingProcessor.name);

  constructor(
    private readonly pipelineRepository: PipelineRepository,
    private readonly brightdata: BrightDataService,
  ) {}

  @Process('scrape-url')
  async handleScrape(
    job: Job<{ targetId: string; url: string; propertyType: string }>,
  ): Promise<{ recordsInserted: number }> {
    this.logger.log(`Scraping: ${job.data.url}`);
    const raw = await this.brightdata.scrape({
      url: job.data.url,
      schema: LISTING_SCHEMA as Record<string, string>,
    });

    if (raw.error) {
      await this.pipelineRepository.updateTargetStatus(job.data.targetId, {
        status: 'failed',
        errorLog: raw.error,
      });
      throw new Error(`Scrape failed: ${raw.error}`);
    }

    let inserted = 0;
    for (const rawRecord of raw.results) {
      const record: ScrapedRecord = {
        title: String(rawRecord.title ?? ''),
        askingPricePhp:
          rawRecord.asking_price_php != null
            ? Number(rawRecord.asking_price_php)
            : null,
        lotAreaSqm:
          rawRecord.lot_area_sqm != null
            ? Number(rawRecord.lot_area_sqm)
            : null,
        floorAreaSqm:
          rawRecord.floor_area_sqm != null
            ? Number(rawRecord.floor_area_sqm)
            : null,
        bedrooms:
          rawRecord.bedrooms != null ? Number(rawRecord.bedrooms) : null,
        bathrooms:
          rawRecord.bathrooms != null ? Number(rawRecord.bathrooms) : null,
        propertyType: String(rawRecord.property_type ?? job.data.propertyType),
        addressRaw: String(rawRecord.address_raw ?? ''),
        barangay:
          rawRecord.barangay != null ? String(rawRecord.barangay) : null,
        city: String(rawRecord.city ?? ''),
        developer:
          rawRecord.developer != null ? String(rawRecord.developer) : null,
        listingDate: String(rawRecord.listing_date ?? ''),
      };

      const flags = applyAutoFlagRules(record);

      let pricePerSqmPhp: number | undefined;
      if (record.askingPricePhp != null) {
        const area = record.lotAreaSqm ?? record.floorAreaSqm;
        if (area != null && area > 0) {
          pricePerSqmPhp = record.askingPricePhp / area;
        }
      }

      let listingDate: Date | undefined;
      if (record.listingDate) {
        const parsed = new Date(record.listingDate);
        if (!isNaN(parsed.getTime())) listingDate = parsed;
      }

      await this.pipelineRepository.createPendingRecord({
        status: 'pending_review',
        sourceUrl: job.data.url,
        title: record.title,
        addressRaw: record.addressRaw,
        city: record.city,
        barangay: record.barangay ?? undefined,
        propertyType: record.propertyType,
        lotAreaSqm: record.lotAreaSqm ?? undefined,
        floorAreaSqm: record.floorAreaSqm ?? undefined,
        bedrooms: record.bedrooms ?? undefined,
        bathrooms: record.bathrooms ?? undefined,
        askingPricePhp: record.askingPricePhp ?? undefined,
        pricePerSqmPhp,
        listingDate,
        developer: record.developer ?? undefined,
        flagged: flags.length > 0,
        flagReason: flags.join('; ') || undefined,
      });

      inserted++;
    }

    await this.pipelineRepository.updateTargetStatus(job.data.targetId, {
      status: 'done',
      scrapedAt: new Date(),
      recordCount: inserted,
    });

    return { recordsInserted: inserted };
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }
}
