import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import {
  ExtractedListingPayload,
  normalizeExtractedListing,
} from '@gavai/pipeline';
import { PipelineRepository } from './pipeline.repository';
import { AimlapiExtractionService } from './services/aimlapi-extraction.service';

@Processor('normalization')
@Injectable()
export class NormalizationProcessor {
  private readonly logger = new Logger(NormalizationProcessor.name);

  constructor(
    private readonly pipelineRepository: PipelineRepository,
    private readonly aimlapiExtraction: AimlapiExtractionService,
  ) {}

  @Process('normalize-record')
  async handleNormalize(
    job: Job<{ recordId: string }>,
  ): Promise<{ recordId: string; status: string }> {
    const record = await this.pipelineRepository.findRecordById(
      job.data.recordId,
    );
    if (!record) return { recordId: job.data.recordId, status: 'missing' };

    const rawTextReference = String(
      record.rawTextReference ??
        [record.title, record.description, record.addressRaw, record.city]
          .filter(Boolean)
          .join('\n'),
    );

    const extracted =
      (await this.aimlapiExtraction.extractListing(rawTextReference)) ??
      fallbackExtraction(record, rawTextReference);

    const normalized = normalizeExtractedListing({
      sourceUrl: record.sourceUrl,
      sourceName: record.sourceName,
      title: record.title,
      description: record.description,
      rawTextReference,
      extracted,
    });

    const flags = [...normalized.normalizationIssues];
    await this.pipelineRepository.updateRecordNormalization(record.id, {
      title: normalized.title,
      description: normalized.description,
      locationRaw: normalized.location,
      city: normalized.city,
      province: normalized.province,
      region: normalized.region,
      propertyType: normalized.propertyType,
      askingPricePhp: normalized.askingPricePhp,
      lotAreaSqm: normalized.lotAreaSqm,
      floorAreaSqm: normalized.floorAreaSqm,
      rawTextReference: normalized.rawTextReference,
      aiExtraction: extracted,
      fieldConfidence: normalized.fieldConfidence,
      confidenceScore: normalized.confidenceScore,
      locationStatus: normalized.locationStatus,
      normalizationStatus: normalized.normalizationStatus,
      normalizationIssues: normalized.normalizationIssues,
      normalizedAt: new Date(),
      trainingEligible: normalized.trainingEligible,
      status:
        normalized.normalizationStatus === 'failed'
          ? 'normalization_failed'
          : 'normalization_review',
      flagged: normalized.normalizationStatus !== 'normalized',
      flagReason: flags.join('; ') || null,
    });

    this.logger.log(
      `Normalized record ${record.id}: city=${normalized.city ?? 'null'} province=${normalized.province ?? 'null'} status=${normalized.normalizationStatus}`,
    );

    return { recordId: record.id, status: normalized.normalizationStatus };
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Normalization job ${job.id} failed: ${error.message}`);
  }
}

function fallbackExtraction(
  record: {
    title: string | null;
    description?: string | null;
    addressRaw: string | null;
    city: string | null;
    propertyType: string | null;
    askingPricePhp: number | null;
    lotAreaSqm: number | null;
    floorAreaSqm: number | null;
  },
  rawTextReference: string,
): ExtractedListingPayload {
  return {
    title: record.title,
    description: record.description ?? null,
    location: {
      raw: record.addressRaw ?? record.city,
      city: record.city,
      province: null,
      confidence: record.city ? 'medium' : 'missing',
      evidence: record.addressRaw ?? null,
    },
    propertyType: {
      value: record.propertyType,
      confidence: record.propertyType ? 'medium' : 'missing',
    },
    price: {
      value: record.askingPricePhp,
      currency: 'PHP',
      confidence: record.askingPricePhp ? 'medium' : 'missing',
    },
    lotArea: {
      value: record.lotAreaSqm,
      unit: 'sqm',
      confidence: record.lotAreaSqm ? 'medium' : 'missing',
    },
    floorArea: {
      value: record.floorAreaSqm,
      unit: 'sqm',
      confidence: record.floorAreaSqm ? 'medium' : 'missing',
    },
    issues: rawTextReference ? [] : ['No raw source text available'],
  };
}
