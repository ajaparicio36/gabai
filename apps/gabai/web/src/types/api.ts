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
}

export interface ReportResponse {
  id: string;
  valuationId: string;
  pdfUrl: string | null;
  verificationHash: string;
  createdAt: string;
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
}
