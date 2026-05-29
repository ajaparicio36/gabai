import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { SITE_DEFAULTS, buildPageUrl } from '@gavai/pipeline';
import type { CrawlProgress } from '@gavai/pipeline';
import { PipelineRepository } from './pipeline.repository';
import { BrightDataService } from './services/brightdata.service';
import { AimlapiExtractionService } from './services/aimlapi-extraction.service';

@Processor('crawling')
@Injectable()
export class CrawlingProcessor {
  private readonly logger = new Logger(CrawlingProcessor.name);

  constructor(
    private readonly pipelineRepository: PipelineRepository,
    private readonly brightdata: BrightDataService,
    private readonly aimlapiExtraction: AimlapiExtractionService,
  ) {}

  @Process('crawl-seed')
  async handleCrawl(
    job: Job<{ seedId: string; maxPages?: number; requestDelayMs?: number }>,
  ): Promise<{ pagesCrawled: number; urlsFound: number; urlsSkipped: number }> {
    const seed = await this.pipelineRepository.findCrawlSeedById(
      job.data.seedId,
    );
    if (!seed) {
      throw new Error(`Crawl seed not found: ${job.data.seedId}`);
    }

    const defaults = SITE_DEFAULTS[seed.site] ?? SITE_DEFAULTS['lamudi'];
    const maxPages = job.data.maxPages ?? seed.maxPages;
    const delayMs = job.data.requestDelayMs ?? seed.requestDelayMs;
    const baseUrl = seed.url.replace(/\/$/, '');

    const crawlJob = await this.pipelineRepository.createCrawlJob({
      seedId: seed.id,
      status: 'running',
      startedAt: new Date(),
    });

    let urlsFound = 0;
    let urlsSkipped = 0;
    let pagesCrawled = 0;
    let consecutiveEmptyPages = 0;

    for (let page = defaults.startPage; page <= maxPages; page++) {
      const pageUrl = buildPageUrl(baseUrl, page, defaults);

      this.logger.log(
        `Crawling ${seed.site} page ${page}/${maxPages}: ${pageUrl}`,
      );

      await this.brightdata.scrapeAsMarkdown(pageUrl);
      const htmlRes = await this.brightdata.scrape({
        url: pageUrl,
        schema: {} as Record<string, string>,
      });

      if (htmlRes.error) {
        this.logger.warn(`Failed to fetch ${pageUrl}: ${htmlRes.error}`);
        consecutiveEmptyPages++;
        if (consecutiveEmptyPages >= 2) break;
        continue;
      }

      const rawHtml =
        htmlRes.results?.[0] != null
          ? String(
              (htmlRes.results[0] as Record<string, unknown>).body ??
                JSON.stringify(htmlRes.results[0]).slice(0, 16000),
            )
          : '';

      if (!rawHtml || rawHtml.length < 200) {
        consecutiveEmptyPages++;
        if (consecutiveEmptyPages >= 2) break;
        continue;
      }

      const extracted = await this.aimlapiExtraction.extractListingUrls(
        rawHtml,
        seed.site,
      );

      if (!extracted || extracted.listings.length === 0) {
        consecutiveEmptyPages++;
        if (consecutiveEmptyPages >= 2) break;
        continue;
      }

      consecutiveEmptyPages = 0;

      const newTargets: {
        url: string;
        urlHash: string;
        status: string;
        location: string;
        propertyType: string;
      }[] = [];

      for (const listing of extracted.listings) {
        if (!listing.url) continue;
        const fullUrl = listing.url.startsWith('http')
          ? listing.url
          : new URL(listing.url, baseUrl).toString();

        const urlHash = this.pipelineRepository.computeUrlHash(fullUrl);
        const exists =
          await this.pipelineRepository.findTargetByUrlHash(urlHash);

        if (exists) {
          urlsSkipped++;
        } else {
          newTargets.push({
            url: fullUrl,
            urlHash,
            status: 'queued',
            location: '',
            propertyType: seed.propertyType,
          });
          urlsFound++;
        }
      }

      if (newTargets.length > 0) {
        await this.pipelineRepository.createScrapingTargets(newTargets);
      }

      pagesCrawled++;

      const progress: CrawlProgress = {
        seedId: seed.id,
        page,
        totalPages: maxPages,
        urlsFound,
        urlsSkipped,
        status: 'running',
      };
      await job.progress(progress as unknown as number);

      if (!extracted.hasNextPage) {
        this.logger.log(`No more pages for ${seed.site} after page ${page}`);
        break;
      }

      await new Promise((r) => setTimeout(r, delayMs));
    }

    await this.pipelineRepository.updateCrawlJob(crawlJob.id, {
      status: 'completed',
      pagesCrawled,
      urlsFound,
      urlsSkipped,
      completedAt: new Date(),
    });

    this.logger.log(
      `Crawl complete for ${seed.site}: ${pagesCrawled} pages, ${urlsFound} new URLs, ${urlsSkipped} skipped`,
    );

    return { pagesCrawled, urlsFound, urlsSkipped };
  }

  @OnQueueFailed()
  async onFailed(job: Job, error: Error): Promise<void> {
    this.logger.error(`Crawl job ${job.id} failed: ${error.message}`);
    const { seedId } = job.data as { seedId: string };
    if (seedId) {
      const crawlJob =
        await this.pipelineRepository.findLatestCrawlJobBySeed(seedId);
      if (crawlJob) {
        await this.pipelineRepository.updateCrawlJob(crawlJob.id, {
          status: 'failed',
          errorLog: error.message,
          completedAt: new Date(),
        });
      }
    }
  }
}
