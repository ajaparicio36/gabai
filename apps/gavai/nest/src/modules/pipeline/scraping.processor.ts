import { Processor, Process, OnQueueFailed, InjectQueue } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { applyAutoFlagRules } from '@gavai/pipeline';
import type { ScrapedRecord } from '@gavai/pipeline';
import { PipelineRepository } from './pipeline.repository';
import { BrightDataService } from './services/brightdata.service';
import { AimlapiExtractionService } from './services/aimlapi-extraction.service';

@Processor('scraping')
@Injectable()
export class ScrapingProcessor {
  private readonly logger = new Logger(ScrapingProcessor.name);

  constructor(
    private readonly pipelineRepository: PipelineRepository,
    private readonly brightdata: BrightDataService,
    private readonly aimlapiExtraction: AimlapiExtractionService,
    @InjectQueue('normalization') private readonly normalizationQueue: Queue,
  ) {}

  @Process('scrape-url')
  async handleScrape(
    job: Job<{ targetId: string; url: string; propertyType: string }>,
  ): Promise<{ recordsInserted: number }> {
    this.logger.log(`Scraping (markdown): ${job.data.url}`);

    // ── Step 1: Fetch page as markdown via BrightData Web Unlocker ──────────
    const markdown = await this.brightdata.scrapeAsMarkdown(job.data.url);

    if (!markdown || markdown.length < 100) {
      await this.pipelineRepository.updateTargetStatus(job.data.targetId, {
        status: 'failed',
        errorLog: 'Empty or too-short markdown response from BrightData',
      });
      throw new Error('Scrape failed: empty markdown response');
    }

    // ── Step 2: AI extraction from markdown (tool calling) ──────────────────
    const extracted = await this.aimlapiExtraction.extractListing(markdown);

    // ── Step 3: Build ScrapedRecord (use AI extraction if available, else raw markdown signals) ──
    const record: ScrapedRecord = {
      title: extracted?.title ?? this.extractTitleFromMarkdown(markdown),
      askingPricePhp: extracted?.price.value ?? null,
      lotAreaSqm: extracted?.lotArea.value ?? null,
      floorAreaSqm: extracted?.floorArea.value ?? null,
      bedrooms: this.extractBedroomsFromMarkdown(markdown),
      bathrooms: this.extractBathroomsFromMarkdown(markdown),
      propertyType:
        extracted?.propertyType.value ?? job.data.propertyType ?? 'unknown',
      addressRaw:
        extracted?.location.raw ??
        extracted?.location.city ??
        this.extractLocationFromMarkdown(markdown) ??
        '',
      barangay: null,
      city: extracted?.location.city ?? '',
      developer: null,
      listingDate: new Date().toISOString().split('T')[0],
    };

    const flags = applyAutoFlagRules(record);

    let pricePerSqmPhp: number | undefined;
    if (record.askingPricePhp != null) {
      const area = record.lotAreaSqm ?? record.floorAreaSqm;
      if (area != null && area > 0) {
        pricePerSqmPhp = record.askingPricePhp / area;
      }
    }

    // Use the full markdown as rawTextReference for normalization — richer than regex-stripped body text
    const rawTextReference = markdown.slice(0, 16000);

    const created = await this.pipelineRepository.createPendingRecord({
      status: 'normalization_pending',
      sourceUrl: job.data.url,
      sourceName: new URL(job.data.url).hostname.replace(/^www\./, ''),
      title: record.title,
      description:
        extracted?.description ?? this.extractDescriptionFromMarkdown(markdown),
      addressRaw: record.addressRaw || undefined,
      city: record.city || undefined,
      barangay: record.barangay ?? undefined,
      propertyType: record.propertyType,
      lotAreaSqm: record.lotAreaSqm ?? undefined,
      floorAreaSqm: record.floorAreaSqm ?? undefined,
      bedrooms: record.bedrooms ?? undefined,
      bathrooms: record.bathrooms ?? undefined,
      askingPricePhp: record.askingPricePhp ?? undefined,
      pricePerSqmPhp,
      developer: record.developer ?? undefined,
      rawTextReference,
      normalizationStatus: 'pending',
      trainingEligible: false,
      flagged: flags.length > 0,
      flagReason: flags.join('; ') || undefined,
      photoUrls: extracted?.photoUrls ?? null,
    });

    await this.normalizationQueue.add('normalize-record', {
      recordId: created.id,
    });

    await this.pipelineRepository.updateTargetStatus(job.data.targetId, {
      status: 'done',
      scrapedAt: new Date(),
      recordCount: 1,
    });

    this.logger.log(
      `Scraped ${job.data.url}: city=${record.city || 'null'} price=${record.askingPricePhp ?? 'null'} type=${record.propertyType}`,
    );

    return { recordsInserted: 1 };
  }

  // ── Lightweight markdown helpers (fallback if AI extraction returns null) ──

  private extractTitleFromMarkdown(markdown: string): string {
    // First H1 or H2 in markdown
    const h1Match = markdown.match(/^#\s+(.+)$/m);
    if (h1Match) return h1Match[1].trim().slice(0, 200);
    const h2Match = markdown.match(/^##\s+(.+)$/m);
    if (h2Match) return h2Match[1].trim().slice(0, 200);
    // Fallback: first non-empty line
    return (
      markdown
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.length > 10) ?? ''
    );
  }

  private extractDescriptionFromMarkdown(markdown: string): string {
    // First paragraph after any heading
    const paragraphs = markdown
      .split(/\n{2,}/)
      .map((p) => p.replace(/^#+\s*/gm, '').trim())
      .filter((p) => p.length > 40 && !p.startsWith('!'));
    return paragraphs.slice(0, 3).join('\n\n').slice(0, 2000);
  }

  private extractBedroomsFromMarkdown(markdown: string): number | null {
    const match = markdown.match(/(\d+)\s*(?:bed(?:room)?s?|br)\b/i);
    return match ? Number(match[1]) : null;
  }

  private extractBathroomsFromMarkdown(markdown: string): number | null {
    const match = markdown.match(/(\d+)\s*(?:bath(?:room)?s?|ba|wc)\b/i);
    return match ? Number(match[1]) : null;
  }

  private extractLocationFromMarkdown(markdown: string): string | null {
    // Look for Metro Manila city names in the markdown
    const LOCATIONS = [
      'Taguig',
      'BGC',
      'Bonifacio Global City',
      'Fort Bonifacio',
      'Makati',
      'Quezon City',
      'Pasig',
      'Mandaluyong',
      'Pasay',
      'Parañaque',
      'Paranaque',
      'Muntinlupa',
      'Las Piñas',
      'Las Pinas',
      'Marikina',
      'Caloocan',
      'Malabon',
      'Navotas',
      'Valenzuela',
      'San Juan',
      'Pateros',
      'Manila',
      'Cebu City',
      'Cebu',
      'Mandaue',
      'Lapu-Lapu',
      'Mactan',
      'Talisay',
      'Iloilo',
    ];
    const text = markdown.slice(0, 3000);
    for (const loc of LOCATIONS) {
      const re = new RegExp(
        `\\b${loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        'i',
      );
      if (re.test(text)) return loc;
    }
    return null;
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }
}
