export interface ApiResponse<T> {
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  } | null;
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  tier: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface ValuationRequest {
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

export interface ValuationResponse {
  propertyType: string;
  pricePerSqmPhp: number;
  pointEstimatePhp: number;
  confidenceLowPhp: number;
  confidenceHighPhp: number;
  confidenceScore: number;
  dataCompleteness: number;
  comparablesUsed: number;
  proximityBreakdown: Record<string, number>;
  modelVersion: string;
  birCompliance: BirCompliance | null;
  id: string;
}

export interface BirCompliance {
  complianceFloorPhp: number | null;
  auditRiskScore: number | null;
  riskLabel: 'green' | 'yellow' | 'red' | 'unknown';
  zonalValuePhp: number | null;
  assessmentLevel: number | null;
  lguAssessedValue: number | null;
}

export interface HeatmapTileResponse {
  type: 'FeatureCollection';
  features: HeatmapFeature[];
  metadata: {
    propertyType: string;
    totalProperties: number;
    priceRange: { min: number; max: number };
  };
}

export interface HeatmapFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    avgPricePerSqm: number;
    medianPricePerSqm: number;
    propertyCount: number;
    colorIntensity: number;
    formula: string;
  };
}

export interface QuickEstimateResponse {
  lowPhp: number;
  medianPhp: number;
  highPhp: number;
  comparablesCount: number;
}

export interface AreaIntelligenceResponse {
  areaName: string;
  bulletPoints: string[];
  sources: { title: string; url: string; domain: string }[];
  lastUpdated: string;
  stale: boolean;
  yieldScore: number | null;
  yieldArticleCount: number | null;
  yieldPositiveRatio: number | null;
  growthScore: number | null;
  growthConfidence: string | null;
  growthReasoning: string | null;
  growthDisclaimer: string;
}

export interface ReportResponse {
  id: string;
  valuationId: string;
  pdfUrl: string | null;
  verificationHash: string;
  createdAt: string;
  normalizedListings: unknown[];
  warnings: string[];
}

export interface ModelVersion {
  id: string;
  version: string;
  modelPath: string;
  status: 'training' | 'ready' | 'deployed' | 'archived' | 'failed';
  mape: number | null;
  trainingRecords: number | null;
  errorLog: string | null;
  deployedAt: string | null;
  createdAt: string;
}

export interface TrainingRecord {
  id: string;
  propertyType: string;
  lotAreaSqm: number | null;
  floorAreaSqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  buildingAgeYears: number | null;
  askingPricePhp: number | null;
  pricePerSqmPhp: number | null;
  barangay: string | null;
  city: string | null;
  developer: string | null;
  phivolcsRisk: string | null;
  floodRisk: string | null;
  zonalValuePhp: number | null;
  crepPhp: number | null;
  proximityScores: unknown;
  createdAt: string;
}

export interface RetrainResponse {
  version: string;
  mape: number;
  trainingRecords: number;
}

export interface TrainQueuedResponse {
  queued: true;
  jobId: string | number | undefined;
}

export interface NormalizedRecord {
  id: string;
  title: string | null;
  city: string | null;
  province: string | null;
  region: string | null;
  propertyType: string | null;
  askingPricePhp: number | null;
  lotAreaSqm: number | null;
  floorAreaSqm: number | null;
  confidenceScore: number | null;
  locationStatus: string | null;
  normalizationStatus: string;
  normalizationIssues: string[] | null;
  trainingEligible: boolean;
  flagged: boolean;
  flagReason: string | null;
}

export interface PromoteResponse {
  status: string;
}

export interface NearbyProperty {
  id: string;
  lat: number;
  lng: number;
  propertyType: string;
  askingPricePhp: number;
  pricePerSqmPhp: number | null;
  lotAreaSqm: number | null;
  floorAreaSqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  barangay: string | null;
  city: string | null;
  addressRaw: string | null;
  photoUrls: string[] | null;
  sourceUrl: string | null;
}

export interface RiskAssessmentResponse {
  scores: {
    flood: number | null;
    traffic: number | null;
    yield: number | null;
    marketPremium: number | null;
    fault: number;
  };
  metadata: {
    flood: { level: string; source: string; returnPeriod: string } | null;
    traffic: { speedRatio: number; cachedAt: string } | null;
    yield: { articleCount: number; positiveRatio: number } | null;
    marketPremium: {
      avmPerSqm: number;
      zonalPerSqm: number;
      ratio: number;
    } | null;
    fault: { status: string };
  };
}
