import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import {
  inferCrepTier,
  computeProximityScore,
  AMENITY_QUERIES,
} from '@gabai/pipeline';
import { SpatialService } from '@gabai/platform';
import { PipelineRepository } from './pipeline.repository';
import { GoogleMapsService } from './services/google-maps.service';

@Processor('enrichment')
@Injectable()
export class EnrichmentProcessor {
  private readonly logger = new Logger(EnrichmentProcessor.name);

  constructor(
    private readonly pipelineRepository: PipelineRepository,
    private readonly googleMaps: GoogleMapsService,
    private readonly spatialService: SpatialService,
  ) {}

  @Process('enrich-record')
  async handleEnrich(
    job: Job<{ recordId: string }>,
  ): Promise<{ propertyId?: string; error?: string }> {
    const record = await this.pipelineRepository.findRecordById(
      job.data.recordId,
    );
    if (!record || record.status !== 'approved') {
      return { error: 'Record not found or not approved' };
    }

    try {
      const addressQuery = `${record.addressRaw ?? ''}, ${record.city ?? ''}, Philippines`;
      const geoResult = await this.googleMaps.geocode(addressQuery);

      if (!geoResult) {
        this.logger.warn(`Geocoding failed for record ${record.id}`);
        return { error: 'Geocoding failed' };
      }

      const placesResult = await this.googleMaps.nearbySearch(
        geoResult.lat,
        geoResult.lng,
      );

      const travelTimes: Record<string, number> = {};
      for (const [label, place] of Object.entries(placesResult.categories)) {
        if (place.placeId) {
          const amenity = AMENITY_QUERIES.find((a) => a.label === label);
          if (amenity) {
            const score =
              1 - Math.min(place.distanceM / amenity.maxDistance, 1);
            travelTimes[label] = Math.round((1 - score) * 1800);
          }
        } else {
          travelTimes[label] = 1800;
        }
      }

      const govRef = await this.pipelineRepository.findGovernmentReference(
        record.barangay ?? '',
        record.city ?? '',
      );

      const neighborhoodMedian =
        await this.spatialService.getNeighborhoodMedianPricePerSqm(
          geoResult.lat,
          geoResult.lng,
          2000,
        );

      const crepResult = inferCrepTier(
        neighborhoodMedian,
        record.developer ?? null,
      );

      computeProximityScore(
        travelTimes,
        govRef?.floodRisk ?? null,
        govRef?.phivolcsRisk ?? null,
      );

      const proximityScores = {
        schools: 1 - Math.min(travelTimes.schools / 1800, 1),
        hospitals: 1 - Math.min(travelTimes.hospitals / 1800, 1),
        malls: 1 - Math.min(travelTimes.malls / 1800, 1),
        transport: 1 - Math.min(travelTimes.transport / 1800, 1),
        business_district: 1 - Math.min(travelTimes.hospitals / 1800, 1),
      };

      const property = await this.pipelineRepository.createProperty({
        sourceUrl: record.sourceUrl ?? undefined,
        scrapedAt: new Date(),
        rawTitle: record.title ?? undefined,
        addressRaw: record.addressRaw ?? undefined,
        googlePlaceId: geoResult.googlePlaceId,
        city: record.city ?? undefined,
        barangay: record.barangay ?? undefined,
        lat: geoResult.lat,
        lng: geoResult.lng,
        propertyType: record.propertyType ?? 'unknown',
        listingType:
          (record.flagReason?.includes('Foreclosed') ?? false)
            ? 'foreclosed'
            : 'standard',
        lotAreaSqm: record.lotAreaSqm ?? undefined,
        floorAreaSqm: record.floorAreaSqm ?? undefined,
        bedrooms: record.bedrooms ?? undefined,
        bathrooms: record.bathrooms ?? undefined,
        developer: record.developer ?? undefined,
        askingPricePhp: record.askingPricePhp ?? 0,
        pricePerSqmPhp: record.pricePerSqmPhp ?? undefined,
        listingDate: record.listingDate ?? undefined,
        zonalValuePhp: govRef?.zonalValuePhp ?? undefined,
        landClassification: govRef?.landClassification ?? undefined,
        proximityScores,
        phivolcsRisk: govRef?.phivolcsRisk ?? undefined,
        floodRisk: govRef?.floodRisk ?? undefined,
        crepTier: crepResult.tier,
        crepPhp: crepResult.crepPhp,
        approved: true,
      });

      return { propertyId: property.id };
    } catch (error) {
      this.logger.error(`Enrichment failed for record ${record.id}: ${error}`);
      return { error: String(error) };
    }
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Enrichment job ${job.id} failed: ${error.message}`);
  }
}
