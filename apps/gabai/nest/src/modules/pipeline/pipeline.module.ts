import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { PipelineRepository } from './pipeline.repository';
import { BrightDataService } from './services/brightdata.service';
import { GoogleMapsService } from './services/google-maps.service';
import { ScrapingProcessor } from './scraping.processor';
import { EnrichmentProcessor } from './enrichment.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'scraping' }, { name: 'enrichment' }),
  ],
  controllers: [PipelineController],
  providers: [
    PipelineService,
    PipelineRepository,
    BrightDataService,
    GoogleMapsService,
    ScrapingProcessor,
    EnrichmentProcessor,
  ],
  exports: [PipelineService, PipelineRepository],
})
export class PipelineModule {}
