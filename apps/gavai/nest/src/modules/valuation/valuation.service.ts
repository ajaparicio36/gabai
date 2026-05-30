import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES, SpatialService } from '@gavai/platform';
import { ValuationRepository } from './valuation.repository.js';
import {
  BirComplianceService,
  BirComplianceResult,
} from './bir-compliance.service.js';

interface ValuationInput {
  lat: number;
  lng: number;
  propertyType: string;
  lotAreaSqm?: number;
  floorAreaSqm?: number;
  bedrooms?: number;
  bathrooms?: number;
  buildingAgeYears?: number;
  address?: string;
  developer?: string;
}

export interface ValuationResult {
  pricePerSqmPhp: number;
  pointEstimatePhp: number;
  confidenceLowPhp: number;
  confidenceHighPhp: number;
  confidenceScore: number;
  dataCompleteness: number;
  comparablesUsed: number;
  proximityBreakdown: Record<string, number>;
  modelVersion: string;
  birCompliance: BirComplianceResult | null;
  id?: string;
}

@Injectable()
export class ValuationService {
  private readonly sidecarUrl: string;

  constructor(
    private readonly valuationRepository: ValuationRepository,
    private readonly spatialService: SpatialService,
    private readonly configService: ConfigService,
    private readonly birComplianceService: BirComplianceService,
    @InjectQueue('training') private readonly trainingQueue: Queue,
  ) {
    this.sidecarUrl = this.configService.getOrThrow<string>('ML_SIDECAR_URL');
  }

  async createAllValuations(
    input: Omit<ValuationInput, 'propertyType'>,
  ): Promise<Record<string, ValuationResult>> {
    const types = ['residential_lot', 'house_and_lot', 'condo', 'commercial'];
    const results = await Promise.all(
      types.map((type) =>
        this.createValuation({ ...input, propertyType: type }),
      ),
    );

    const resultMap: Record<string, ValuationResult> = {};
    types.forEach((type, i) => {
      resultMap[type] = results[i];
    });
    return resultMap;
  }

  async createValuation(input: ValuationInput): Promise<ValuationResult> {
    const { features, comparables, proximityBreakdown } =
      await this.assembleFeatures(input);

    const dataCompleteness = this.computeDataCompleteness(input);

    const barangay = comparables[0]?.barangay ?? null;
    const city = comparables[0]?.city ?? null;
    const birCompliance = await this.birComplianceService.computeBirFloor(
      barangay as string | null,
      city as string | null,
      input.address ?? null,
      null,
      input.lotAreaSqm ?? null,
      input.floorAreaSqm ?? null,
    );

    let sidecarResult: {
      price_per_sqm_php: number;
      point_estimate_php: number;
      confidence_low_php: number;
      confidence_high_php: number;
      confidence_score: number;
      model_version: string;
      method: string;
    } | null = null;

    try {
      const response = await fetch(`${this.sidecarUrl}/api/v1/infer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(features),
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        const json = (await response.json()) as Record<string, unknown>;
        sidecarResult = {
          price_per_sqm_php: json.price_per_sqm_php as number,
          point_estimate_php: json.point_estimate_php as number,
          confidence_low_php: json.confidence_low_php as number,
          confidence_high_php: json.confidence_high_php as number,
          confidence_score: json.confidence_score as number,
          model_version: json.model_version as string,
          method: json.method as string,
        };
      }
    } catch {
      void 0;
    }

    let result: ValuationResult;
    if (sidecarResult?.price_per_sqm_php != null) {
      const compDensity = comparables.filter((c) => c.distance_m < 2000).length;
      const conf = this.computeConfidence(
        compDensity,
        dataCompleteness,
        proximityBreakdown,
      );

      result = {
        pricePerSqmPhp: sidecarResult.price_per_sqm_php,
        pointEstimatePhp: sidecarResult.point_estimate_php,
        confidenceLowPhp: sidecarResult.confidence_low_php,
        confidenceHighPhp: sidecarResult.confidence_high_php,
        confidenceScore: conf.confidenceScore,
        dataCompleteness,
        comparablesUsed: comparables.length,
        proximityBreakdown,
        modelVersion: sidecarResult.model_version ?? 'unknown',
        birCompliance,
      };
    } else {
      result = this.formulaFallback(input, comparables, proximityBreakdown);
      result.dataCompleteness = dataCompleteness;
      result.birCompliance = birCompliance;
    }

    if (birCompliance?.complianceFloorPhp && result.pointEstimatePhp) {
      const floor = birCompliance.complianceFloorPhp;
      const sRisk = ((result.pointEstimatePhp - floor) / floor) * 100;
      birCompliance.auditRiskScore = Math.round(sRisk * 100) / 100;
      if (sRisk > 0) birCompliance.riskLabel = 'green';
      else if (sRisk >= -5) birCompliance.riskLabel = 'yellow';
      else birCompliance.riskLabel = 'red';
    }

    const valuation = await this.valuationRepository.createValuation({
      inputLat: input.lat,
      inputLng: input.lng,
      inputAddress: input.address,
      propertyType: input.propertyType,
      lotAreaSqm: input.lotAreaSqm,
      floorAreaSqm: input.floorAreaSqm,
      pointEstimatePhp: result.pointEstimatePhp,
      confidenceLowPhp: result.confidenceLowPhp,
      confidenceHighPhp: result.confidenceHighPhp,
      confidenceScore: result.confidenceScore,
      dataCompleteness,
      comparablesUsed: comparables.slice(0, 10).map((c) => ({
        id: c.id,
        distanceM: c.distance_m,
        pricePerSqm: c.pricePerSqmPhp,
      })),
      proximityBreakdown,
      modelVersion: result.modelVersion,
      birCompliance: birCompliance as unknown as Record<string, unknown>,
    });

    return { ...result, id: valuation.id };
  }

  async getValuation(id: string): Promise<ValuationResult> {
    const valuation = await this.valuationRepository.findValuationById(id);
    if (!valuation) {
      throw new BadRequestException({
        code: ERROR_CODES.NOT_FOUND.VALUATION,
        message: 'Valuation not found',
      });
    }
    const area = valuation.lotAreaSqm ?? valuation.floorAreaSqm ?? 1;
    return {
      pricePerSqmPhp: area > 0 ? valuation.pointEstimatePhp / area : 0,
      pointEstimatePhp: valuation.pointEstimatePhp,
      confidenceLowPhp: valuation.confidenceLowPhp,
      confidenceHighPhp: valuation.confidenceHighPhp,
      confidenceScore: valuation.confidenceScore,
      dataCompleteness: valuation.dataCompleteness,
      comparablesUsed: Array.isArray(valuation.comparablesUsed)
        ? (valuation.comparablesUsed as unknown[]).length
        : 0,
      proximityBreakdown:
        (valuation.proximityBreakdown as Record<string, number>) ?? {},
      modelVersion: valuation.modelVersion,
      birCompliance:
        (valuation.birCompliance as unknown as BirComplianceResult) ?? null,
      id: valuation.id,
    };
  }

  async getModelInfo() {
    try {
      const response = await fetch(`${this.sidecarUrl}/api/v1/model/info`, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) return await response.json();
    } catch {
      void 0;
    }
    return { version: null, status: 'model_unavailable' };
  }

  async triggerRetrain(): Promise<{
    queued: true;
    jobId: string | number | undefined;
  }> {
    const records = await this.valuationRepository.getTrainingRecords();
    if (records.length < 20) {
      throw new BadRequestException({
        code: ERROR_CODES.VALUATION.INSUFFICIENT_DATA,
        message: `Need at least 20 normalized training records. Found ${records.length}.`,
      });
    }

    const job = await this.trainingQueue.add(
      'train-avm',
      {},
      { attempts: 1, removeOnComplete: 50, removeOnFail: 100 },
    );

    return { queued: true, jobId: job.id };
  }

  async getModelVersions() {
    return this.valuationRepository.findModelVersions();
  }

  async getTrainingRecords() {
    return this.valuationRepository.getTrainingRecords();
  }

  async promoteModelVersion(version: string): Promise<{ status: string }> {
    const modelVersion =
      await this.valuationRepository.findModelVersionByVersion(version);
    if (!modelVersion) {
      throw new BadRequestException({
        code: ERROR_CODES.NOT_FOUND.MODEL_VERSION,
        message: `Model version ${version} not found`,
      });
    }

    try {
      const response = await fetch(`${this.sidecarUrl}/api/v1/admin/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_path: modelVersion.modelPath }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error('Load failed');
      }

      const prevDeployed =
        await this.valuationRepository.findLatestModelVersion('deployed');
      if (prevDeployed) {
        await this.valuationRepository.updateModelVersion(prevDeployed.id, {
          status: 'archived',
        });
      }

      await this.valuationRepository.updateModelVersion(modelVersion.id, {
        status: 'deployed',
        deployedAt: new Date(),
      });

      return { status: 'promoted' };
    } catch (error) {
      throw new InternalServerErrorException({
        code: ERROR_CODES.VALUATION.ML_SIDECAR_ERROR,
        message: `Model hot-swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  private async assembleFeatures(input: ValuationInput): Promise<{
    features: Record<string, number | string>;
    comparables: {
      id: string;
      distance_m: number;
      pricePerSqmPhp: number | null;
      barangay: string | null;
      city: string | null;
    }[];
    proximityBreakdown: Record<string, number>;
  }> {
    const comparables = await this.spatialService.getComparables(
      input.lat,
      input.lng,
      3000,
      input.propertyType,
    );

    const neighborhoodMedian =
      await this.spatialService.getNeighborhoodMedianPricePerSqm(
        input.lat,
        input.lng,
        2000,
      );

    const listingVelocity = await this.spatialService.getNearbyListingVelocity(
      input.lat,
      input.lng,
      1000,
    );

    const representativeComparable = comparables[0];
    const barangay = representativeComparable?.barangay ?? '';
    const city = representativeComparable?.city ?? '';
    const medianMovement =
      barangay && city
        ? await this.spatialService.getMedianPriceMovement(barangay, city)
        : null;

    const { crepResult } = this.inferCrepTier(neighborhoodMedian);
    const creepPhp = crepResult.crepPhp;

    const proximityBreakdown = {
      schools:
        0.5 +
        (neighborhoodMedian ? Math.min(neighborhoodMedian / 100000, 0.3) : 0),
      hospitals: 0.5,
      malls: 0.5,
      transport: 0.5,
    };

    const features: Record<string, number | string> = {
      lot_area_sqm: input.lotAreaSqm ?? 0,
      floor_area_sqm: input.floorAreaSqm ?? 0,
      bedrooms: input.bedrooms ?? 0,
      bathrooms: input.bathrooms ?? 0,
      building_age_years: input.buildingAgeYears ?? 10,
      type_residential_lot: input.propertyType === 'residential_lot' ? 1 : 0,
      type_house_and_lot: input.propertyType === 'house_and_lot' ? 1 : 0,
      type_condo: input.propertyType === 'condo' ? 1 : 0,
      type_commercial: input.propertyType === 'commercial' ? 1 : 0,
      barangay_encoded: this.hashLabel(barangay),
      city_encoded: this.hashLabel(city),
      crep_php: creepPhp,
      score_schools: proximityBreakdown.schools,
      score_hospitals: proximityBreakdown.hospitals,
      score_malls: proximityBreakdown.malls,
      score_transport: proximityBreakdown.transport,
      phivolcs_risk: 0,
      flood_risk: 0,
      zonal_value_php: 0,
      listing_velocity_30d: listingVelocity,
      median_price_movement_90d: medianMovement ?? 0,
    };

    return { features, comparables, proximityBreakdown };
  }

  private inferCrepTier(neighborhoodMedian: number | null): {
    crepResult: { tier: string; crepPhp: number };
  } {
    const tiers: { tier: string; minPrice: number; crepPhp: number }[] = [
      { tier: 'economy', minPrice: 0, crepPhp: 15000 },
      { tier: 'standard', minPrice: 25000, crepPhp: 23000 },
      { tier: 'medium', minPrice: 45000, crepPhp: 36500 },
      { tier: 'high_end', minPrice: 80000, crepPhp: 62500 },
      { tier: 'luxury', minPrice: 130000, crepPhp: 100000 },
    ];

    const price = neighborhoodMedian ?? 0;
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (price >= tiers[i].minPrice) {
        return { crepResult: tiers[i] };
      }
    }
    return { crepResult: tiers[0] };
  }

  private computeConfidence(
    numComparables: number,
    dataCompleteness: number,
    proximityBreakdown: Record<string, number>,
  ): { confidenceScore: number; ciPercent: number } {
    const densityBonus = Math.min(numComparables / 10, 1);
    const proximityDensity =
      Object.values(proximityBreakdown).reduce((a, b) => a + b, 0) /
      Math.max(Object.keys(proximityBreakdown).length, 1);

    const rawScore =
      0.4 * densityBonus + 0.4 * dataCompleteness + 0.2 * proximityDensity;

    const confidenceScore = Math.round(rawScore * 100) / 100;
    const ciPercent = 0.3 - rawScore * 0.15;
    const clampedCi = Math.max(0.12, Math.min(0.3, ciPercent));

    return { confidenceScore, ciPercent: clampedCi };
  }

  private computeDataCompleteness(input: ValuationInput): number {
    let present = 0;
    const total = 8;
    if (input.lotAreaSqm != null || input.floorAreaSqm != null) present++;
    if (input.bedrooms != null) present++;
    if (input.bathrooms != null) present++;
    if (input.buildingAgeYears != null) present++;
    if (input.developer != null) present++;
    if (input.lat != null && input.lng != null) present += 2;
    present++;
    return present / total;
  }

  private formulaFallback(
    input: ValuationInput,
    _comparables: unknown[],
    proximityBreakdown: Record<string, number>,
  ): ValuationResult {
    const basePerSqm = 25000;
    const area = input.lotAreaSqm ?? input.floorAreaSqm ?? 100;
    const estimate = basePerSqm * area;

    return {
      pricePerSqmPhp: basePerSqm,
      pointEstimatePhp: estimate,
      confidenceLowPhp: estimate * 0.75,
      confidenceHighPhp: estimate * 1.25,
      confidenceScore: 0.4,
      dataCompleteness: 0.5,
      comparablesUsed: 0,
      proximityBreakdown,
      modelVersion: 'formula_fallback',
      birCompliance: null,
    };
  }

  private hashLabel(label: string): number {
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
      const char = label.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return Math.abs(hash) % 1000;
  }
}
