import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from '../auth/auth.module';
import { QueueModule } from '../queue/queue.module';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { PipelineRepository } from './pipeline.repository';
import { BrightDataService } from './services/brightdata.service';
import { GoogleMapsService } from './services/google-maps.service';
import { ZonalLookupService } from './services/zonal-lookup.service';
import { AimlapiExtractionService } from './services/aimlapi-extraction.service';
import { ArticleCacheService } from './services/article-cache.service';
import { ScrapingProcessor } from './scraping.processor';
import { NormalizationProcessor } from './normalization.processor';
import { EnrichmentProcessor } from './enrichment.processor';
import { CrawlingProcessor } from './crawling.processor';

@Module({
  imports: [
    AuthModule,
    QueueModule,
    BullModule.registerQueue(
      { name: 'scraping' },
      { name: 'normalization' },
      { name: 'enrichment' },
      { name: 'crawling' },
    ),
  ],
  controllers: [PipelineController],
  providers: [
    PipelineService,
    PipelineRepository,
    BrightDataService,
    GoogleMapsService,
    ZonalLookupService,
    AimlapiExtractionService,
    ArticleCacheService,
    ScrapingProcessor,
    NormalizationProcessor,
    EnrichmentProcessor,
    CrawlingProcessor,
  ],
  exports: [
    PipelineService,
    PipelineRepository,
    BrightDataService,
    GoogleMapsService,
    ZonalLookupService,
    AimlapiExtractionService,
    ArticleCacheService,
  ],
})
export class PipelineModule {}
