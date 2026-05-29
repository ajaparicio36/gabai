import {
  LocationConfidence,
  normalizePhilippineLocation,
} from './location-normalization.js';

export type FieldConfidence = 'high' | 'medium' | 'low' | 'missing';
export type NormalizationStatus =
  | 'pending'
  | 'normalized'
  | 'low_confidence'
  | 'failed';

export interface ExtractedListingPayload {
  title: string | null;
  description: string | null;
  location: {
    raw: string | null;
    city: string | null;
    province: string | null;
    confidence: FieldConfidence;
    evidence: string | null;
  };
  propertyType: { value: string | null; confidence: FieldConfidence };
  price: { value: number | null; currency: 'PHP'; confidence: FieldConfidence };
  lotArea: { value: number | null; unit: 'sqm'; confidence: FieldConfidence };
  floorArea: { value: number | null; unit: 'sqm'; confidence: FieldConfidence };
  issues: string[];
}

export interface NormalizeExtractedListingInput {
  sourceUrl: string | null;
  sourceName: string | null;
  title: string | null;
  description: string | null;
  rawTextReference: string;
  extracted: ExtractedListingPayload;
}

export interface NormalizedListingResult {
  title: string | null;
  description: string | null;
  location: string | null;
  city: string | null;
  province: string | null;
  region: string | null;
  propertyType: string | null;
  askingPricePhp: number | null;
  lotAreaSqm: number | null;
  floorAreaSqm: number | null;
  sourceUrl: string | null;
  sourceName: string | null;
  confidenceScore: number;
  rawTextReference: string;
  normalizationStatus: NormalizationStatus;
  normalizationIssues: string[];
  locationStatus: LocationConfidence;
  trainingEligible: boolean;
  fieldConfidence: Record<string, FieldConfidence>;
}

export function normalizeExtractedListing(
  input: NormalizeExtractedListingInput,
): NormalizedListingResult {
  const issues = [...input.extracted.issues];
  const location = normalizePhilippineLocation({
    title: input.title ?? input.extracted.title,
    body: input.description ?? input.extracted.description,
    rawLocation: input.extracted.location.raw,
    aiCity: input.extracted.location.city,
    aiProvince: input.extracted.location.province,
  });

  issues.push(...location.issues);

  const price = cleanPositiveNumber(input.extracted.price.value);
  const lotArea = cleanPositiveNumber(input.extracted.lotArea.value);
  const floorArea = cleanPositiveNumber(input.extracted.floorArea.value);

  if (price == null) issues.push('Missing price');
  if (lotArea == null && floorArea == null) {
    issues.push('Missing lotAreaSqm and floorAreaSqm');
  }

  const hardFailure =
    location.status === 'missing' ||
    price == null ||
    (lotArea == null && floorArea == null);
  const confidenceScore = computeConfidenceScore(
    input.extracted.location.confidence,
    input.extracted.propertyType.confidence,
    input.extracted.price.confidence,
    input.extracted.lotArea.confidence,
    input.extracted.floorArea.confidence,
  );

  // Threshold at 0.55 — keeps salvageable records while still filtering junk.
  // The independent location.status === 'low' check was removed because the
  // weighted formula already penalizes low-confidence location appropriately.
  const normalizationStatus: NormalizationStatus = hardFailure
    ? 'failed'
    : confidenceScore < 0.55
      ? 'low_confidence'
      : 'normalized';

  return {
    title: input.extracted.title ?? input.title,
    description: input.extracted.description ?? input.description,
    location: location.raw,
    city: location.city,
    province: location.province,
    region: location.region,
    propertyType: input.extracted.propertyType.value,
    askingPricePhp: price,
    lotAreaSqm: lotArea,
    floorAreaSqm: floorArea,
    sourceUrl: input.sourceUrl,
    sourceName: input.sourceName,
    confidenceScore,
    rawTextReference: input.rawTextReference,
    normalizationStatus,
    normalizationIssues: [...new Set(issues)],
    locationStatus: location.status,
    trainingEligible: normalizationStatus === 'normalized',
    fieldConfidence: {
      location: input.extracted.location.confidence,
      propertyType: input.extracted.propertyType.confidence,
      price: input.extracted.price.confidence,
      lotArea: input.extracted.lotArea.confidence,
      floorArea: input.extracted.floorArea.confidence,
    },
  };
}

function cleanPositiveNumber(value: number | null): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function computeConfidenceScore(
  locationConf: FieldConfidence,
  propertyTypeConf: FieldConfidence,
  priceConf: FieldConfidence,
  lotAreaConf: FieldConfidence,
  floorAreaConf: FieldConfidence,
): number {
  const weights: Record<FieldConfidence, number> = {
    high: 1,
    medium: 0.75,
    low: 0.35,
    missing: 0,
  };

  // Weighted formula: price (30%) and location (25%) matter most for AVM;
  // area fields (17.5% each) are next; property type (10%) least critical.
  const fieldWeights = {
    price: 0.3,
    location: 0.25,
    lotArea: 0.175,
    floorArea: 0.175,
    propertyType: 0.1,
  };

  const score =
    weights[priceConf] * fieldWeights.price +
    weights[locationConf] * fieldWeights.location +
    weights[lotAreaConf] * fieldWeights.lotArea +
    weights[floorAreaConf] * fieldWeights.floorArea +
    weights[propertyTypeConf] * fieldWeights.propertyType;

  return Math.round(score * 100) / 100;
}
