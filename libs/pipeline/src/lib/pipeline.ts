export const LISTING_SCHEMA = {
  title: 'string',
  asking_price_php: 'number',
  lot_area_sqm: 'number | null',
  floor_area_sqm: 'number | null',
  bedrooms: 'number | null',
  bathrooms: 'number | null',
  property_type: 'string',
  address_raw: 'string',
  barangay: 'string | null',
  city: 'string',
  developer: 'string | null',
  listing_date: 'string',
} as const;

export const CREP_TIERS = [
  { tier: 'economy' as const, minPrice: 0, value: 15000 },
  { tier: 'standard' as const, minPrice: 25000, value: 23000 },
  { tier: 'medium' as const, minPrice: 45000, value: 36500 },
  { tier: 'high_end' as const, minPrice: 80000, value: 62500 },
  { tier: 'luxury' as const, minPrice: 130000, value: 100000 },
];

export const DEVELOPER_TIERS: Record<string, string[]> = {
  luxury: ['Ayala Land Premier', 'Rockwell', 'Shang Properties', 'Alveo'],
  high_end: ['Avida', 'DMCI Homes', 'Filinvest'],
  standard: ['Camella', 'Phinma Properties', 'Deca Homes'],
  economy: ['BellaVita', 'Lessandra', 'Phirst Park Homes'],
};

export type CrepTier = (typeof CREP_TIERS)[number]['tier'];

export interface CrepResult {
  tier: CrepTier;
  crepPhp: number;
}

export interface AutoFlagResult {
  flagged: boolean;
  reasons: string[];
}

export interface ScrapedRecord {
  title: string;
  askingPricePhp: number | null;
  lotAreaSqm: number | null;
  floorAreaSqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  propertyType: string;
  addressRaw: string;
  barangay: string | null;
  city: string;
  developer: string | null;
  listingDate: string;
}

export interface EnrichmentResult {
  lat: number;
  lng: number;
  googlePlaceId: string;
  proximityScores: {
    schools: number;
    hospitals: number;
    malls: number;
    transport: number;
    business_district: number;
  };
  travelTimes: {
    schools: number;
    hospitals: number;
    malls: number;
    transport: number;
  };
}

export interface ProximityWeights {
  positive: {
    school: number;
    business_district: number;
    shopping_mall: number;
    public_transit: number;
  };
  negative: {
    flood_high: number;
    flood_medium: number;
    flood_low: number;
    earthquake: number;
  };
}

export const PROXIMITY_WEIGHTS: ProximityWeights = {
  positive: {
    school: 0.18,
    business_district: 0.2,
    shopping_mall: 0.15,
    public_transit: 0.12,
  },
  negative: {
    flood_high: -0.25,
    flood_medium: -0.12,
    flood_low: -0.05,
    earthquake: -0.09,
  },
};

export const AMENITY_QUERIES = [
  { type: 'school' as const, label: 'schools', maxDistance: 1500 },
  { type: 'hospital' as const, label: 'hospitals', maxDistance: 3000 },
  { type: 'shopping_mall' as const, label: 'malls', maxDistance: 2000 },
  { type: 'transit_station' as const, label: 'transport', maxDistance: 1000 },
];

export const FORECLOSED_KEYWORDS = [
  'foreclosed',
  'bank acquired',
  'pag-ibig acquired',
  'acquired asset',
  'foreclosure',
];

export function inferCrepTier(
  neighborhoodMedianPricePerSqm: number | null,
  developer: string | null,
): CrepResult {
  let devTier: CrepTier | undefined;
  if (developer) {
    const devLower = developer.toLowerCase();
    for (const [tier, devs] of Object.entries(DEVELOPER_TIERS)) {
      if (devs.some((d) => devLower.includes(d.toLowerCase()))) {
        devTier = tier as CrepTier;
        break;
      }
    }
  }

  if (devTier) {
    const entry = CREP_TIERS.find((t) => t.tier === devTier)!;
    return { tier: entry.tier, crepPhp: entry.value };
  }

  const price = neighborhoodMedianPricePerSqm ?? 0;
  for (let i = CREP_TIERS.length - 1; i >= 0; i--) {
    if (price >= CREP_TIERS[i].minPrice) {
      return { tier: CREP_TIERS[i].tier, crepPhp: CREP_TIERS[i].value };
    }
  }
  return { tier: 'economy', crepPhp: 15000 };
}

export function computeProximityScore(
  travelTimes: Record<string, number>,
  floodRisk: number | null,
  earthquakeRisk: number | null,
): number {
  const { positive: posWeights, negative: negWeights } = PROXIMITY_WEIGHTS;

  const proximityScore =
    (1 - Math.min(travelTimes.schools / 1800, 1)) * posWeights.school +
    (1 - Math.min(travelTimes.hospitals / 1800, 1)) *
      posWeights.business_district +
    (1 - Math.min(travelTimes.malls / 1800, 1)) * posWeights.shopping_mall +
    (1 - Math.min(travelTimes.transport / 1800, 1)) * posWeights.public_transit;

  let riskScore = 0;
  if (floodRisk != null) {
    if (floodRisk >= 0.7) riskScore += negWeights.flood_high;
    else if (floodRisk >= 0.4) riskScore += negWeights.flood_medium;
    else riskScore += negWeights.flood_low;
  }
  if (earthquakeRisk != null && earthquakeRisk >= 0.5) {
    riskScore += negWeights.earthquake;
  }

  return Math.max(0.5, Math.min(1.5, proximityScore + riskScore));
}

export function applyAutoFlagRules(record: ScrapedRecord): string[] {
  const flags: string[] = [];

  if (record.askingPricePhp == null || record.askingPricePhp < 100_000) {
    flags.push('Price missing or implausibly low');
  }
  if (
    (record.lotAreaSqm != null && record.lotAreaSqm > 50_000) ||
    (record.floorAreaSqm != null && record.floorAreaSqm > 10_000)
  ) {
    flags.push('Area implausibly large');
  }
  if (
    record.askingPricePhp != null &&
    record.lotAreaSqm == null &&
    record.floorAreaSqm == null
  ) {
    flags.push('Cannot compute per-sqm price');
  }

  const titleLower = (record.title ?? '').toLowerCase();
  for (const keyword of FORECLOSED_KEYWORDS) {
    if (titleLower.includes(keyword)) {
      flags.push('Foreclosed property — excluded from training');
      break;
    }
  }

  return flags;
}

export function computeAmenityScore(
  distanceM: number,
  maxDistance: number,
): number {
  return Math.max(0, Math.min(1, 1 - distanceM / maxDistance));
}

export function computeTravelTimeScore(travelSeconds: number): number {
  return Math.max(0, Math.min(1, 1 - travelSeconds / 1800));
}

export interface DataCompletenessResult {
  score: number;
  missingFields: string[];
  refusals: string[];
}

export function checkDataCompleteness(record: {
  askingPricePhp: number | null;
  lotAreaSqm: number | null;
  floorAreaSqm: number | null;
  buildingAgeYears: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  developer: string | null;
  proximityScores: Record<string, number> | null;
}): DataCompletenessResult {
  const refusals: string[] = [];
  const missingFields: string[] = [];
  let presentCount = 0;
  const totalFields = 8;

  if (record.askingPricePhp == null) {
    refusals.push('askingPricePhp missing');
  } else {
    presentCount++;
  }

  if (record.lotAreaSqm == null && record.floorAreaSqm == null) {
    refusals.push('Both lotAreaSqm and floorAreaSqm missing');
  } else {
    presentCount++;
  }

  const checkField = (value: unknown, name: string): void => {
    if (value == null) missingFields.push(name);
    else presentCount++;
  };

  checkField(record.buildingAgeYears, 'buildingAgeYears');
  checkField(record.bedrooms, 'bedrooms');
  checkField(record.bathrooms, 'bathrooms');
  checkField(record.developer, 'developer');

  if (record.proximityScores == null) {
    missingFields.push('proximityScores');
  } else {
    const missingProx = Object.entries(record.proximityScores)
      .filter(([, v]) => v == null)
      .map(([k]) => k);
    if (missingProx.length >= 2)
      missingFields.push('2+ proximity scores missing');
    presentCount++;
  }

  const score = refusals.length > 0 ? 0 : presentCount / totalFields;

  return { score: Math.round(score * 100) / 100, missingFields, refusals };
}
