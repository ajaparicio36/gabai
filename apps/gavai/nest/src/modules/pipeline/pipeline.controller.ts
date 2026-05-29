import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Delete,
  Patch,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PipelineService } from './pipeline.service';
import { DiscoverDto, DiscoverApproveDto } from './dto/discover.dto';
import { ScrapeApproveDto, ScrapeRejectDto } from './dto/scrape.dto';
import {
  CreateCrawlSeedDto,
  UpdateCrawlSeedDto,
  CrawlRunDto,
} from './dto/crawl.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Post('discover')
  async runDiscover(@Body() dto: DiscoverDto) {
    return this.pipelineService.discover(dto.location, dto.propertyType);
  }

  @Post('discover/approve')
  async approveDiscover(@Body() dto: DiscoverApproveDto) {
    return this.pipelineService.approveDiscoverTargets(dto.ids);
  }

  @Post('scrape/run')
  async runScrape() {
    return this.pipelineService.runScrape();
  }

  @Post('scrape/approve')
  async approveScrape(@Body() dto: ScrapeApproveDto) {
    return this.pipelineService.approveScrapeRecords(dto.ids);
  }

  @Post('scrape/reject')
  async rejectScrape(@Body() dto: ScrapeRejectDto) {
    return this.pipelineService.rejectScrapeRecords(dto.ids);
  }

  @Get('discover/targets')
  async getDiscoverTargets() {
    return this.pipelineService.getPendingTargets();
  }

  @Get('scrape/queue-status')
  async getQueueStatus() {
    return this.pipelineService.getQueueStatus();
  }

  @Get('scrape/records')
  async getScrapeRecords() {
    return this.pipelineService.getPendingRecords();
  }

  @Get('scrape/jobs')
  async getScrapingJobs() {
    return this.pipelineService.getScrapingJobs();
  }

  @Get('scrape/records/:id')
  async getRecord(@Param('id') id: string) {
    return this.pipelineService.getRecordById(id);
  }

  @Post('normalize/run')
  async runNormalize(@Body() dto: ScrapeApproveDto) {
    return this.pipelineService.queueNormalizationForRecords(dto.ids);
  }

  @Get('normalize/records')
  async getNormalizeRecords() {
    return this.pipelineService.getNormalizationRecords();
  }

  @Post('normalize/approve')
  async approveNormalize(@Body() dto: ScrapeApproveDto) {
    return this.pipelineService.approveNormalizedRecords(dto.ids);
  }

  @Post('normalize/reject')
  async rejectNormalize(@Body() dto: ScrapeRejectDto) {
    return this.pipelineService.rejectNormalizationRecords(dto.ids);
  }

  @Post('crawl/seeds')
  async createCrawlSeed(@Body() dto: CreateCrawlSeedDto) {
    return this.pipelineService.createCrawlSeed(dto);
  }

  @Get('crawl/seeds')
  async getCrawlSeeds(
    @Query('enabled') enabled?: string,
    @Query('site') site?: string,
  ) {
    return this.pipelineService.getCrawlSeeds({
      enabled: enabled !== undefined ? enabled === 'true' : undefined,
      site,
    });
  }

  @Get('crawl/seeds/:id')
  async getCrawlSeedById(@Param('id') id: string) {
    return this.pipelineService.getCrawlSeedById(id);
  }

  @Patch('crawl/seeds/:id')
  async updateCrawlSeed(
    @Param('id') id: string,
    @Body() dto: UpdateCrawlSeedDto,
  ) {
    return this.pipelineService.updateCrawlSeed(id, dto);
  }

  @Delete('crawl/seeds/:id')
  async deleteCrawlSeed(@Param('id') id: string) {
    return this.pipelineService.deleteCrawlSeed(id);
  }

  @Post('crawl/run')
  async runCrawl(@Body() dto: CrawlRunDto) {
    return this.pipelineService.runCrawl(dto.seedIds, {
      maxPages: dto.maxPages,
      requestDelayMs: dto.requestDelayMs,
    });
  }

  @Get('crawl/jobs')
  async getCrawlJobs(@Query('limit') limit?: string) {
    const parsed = limit ? parseInt(limit, 10) : 20;
    return this.pipelineService.getCrawlJobs(parsed);
  }

  @Get('crawl/jobs/:id')
  async getCrawlJobById(@Param('id') id: string) {
    return this.pipelineService.getCrawlJobById(id);
  }

  @Post('crawl/auto-scrape')
  async autoScrapeCrawledTargets() {
    return this.pipelineService.autoScrapeCrawledTargets();
  }
}
