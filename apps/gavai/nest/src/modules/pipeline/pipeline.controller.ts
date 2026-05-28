import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PipelineService } from './pipeline.service';
import { DiscoverDto, DiscoverApproveDto } from './dto/discover.dto';
import { ScrapeApproveDto, ScrapeRejectDto } from './dto/scrape.dto';

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
}
