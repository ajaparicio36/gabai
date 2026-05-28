import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { PipelineRepository } from './pipeline.repository';
import { BrightDataService } from './services/brightdata.service';
import { GoogleMapsService } from './services/google-maps.service';
import { ZonalLookupService } from './services/zonal-lookup.service';
import { ScrapingProcessor } from './scraping.processor';
import { EnrichmentProcessor } from './enrichment.processor';

@Module({
  imports: [
    AuthModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: new URL(configService.getOrThrow<string>('REDIS_URL')).hostname,
          port:
            Number(
              new URL(configService.getOrThrow<string>('REDIS_URL')).port,
            ) || 6379,
          password:
            new URL(configService.getOrThrow<string>('REDIS_URL')).password ||
            undefined,
        },
      }),
    }),
    BullModule.registerQueue({ name: 'scraping' }, { name: 'enrichment' }),
  ],
  controllers: [PipelineController],
  providers: [
    PipelineService,
    PipelineRepository,
    BrightDataService,
    GoogleMapsService,
    ZonalLookupService,
    ScrapingProcessor,
    EnrichmentProcessor,
  ],
  exports: [
    PipelineService,
    PipelineRepository,
    BrightDataService,
    GoogleMapsService,
    ZonalLookupService,
  ],
})
export class PipelineModule {}
