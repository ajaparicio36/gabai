export interface FloodScore {
  score: number;
  level: string;
  returnPeriod: string;
  source: string;
}

export interface TrafficScore {
  score: number;
  speedRatio: number;
  freeflowDuration: number;
  avgPeakDuration: number;
  nearestCbd: string;
  cachedAt: string;
}

export interface YieldScore {
  score: number;
  articleCount: number;
  positiveRatio: number;
  infraRatio: number;
}

export interface MarketPremiumScore {
  score: number;
  avmPerSqm: number;
  zonalPerSqm: number | null;
  ratio: number | null;
}

export interface RiskScores {
  flood: number | null;
  traffic: number | null;
  yield: number | null;
  marketPremium: number | null;
  fault: number;
}

export interface RiskMetadata {
  flood: {
    level: string;
    source: string;
    returnPeriod: string;
    description: string;
  } | null;
  traffic: { speedRatio: number; cachedAt: string } | null;
  yield: { articleCount: number; positiveRatio: number } | null;
  marketPremium: {
    avmPerSqm: number;
    zonalPerSqm: number;
    ratio: number;
  } | null;
  fault: { status: string };
}

export interface RiskAssessmentResult {
  scores: RiskScores;
  metadata: RiskMetadata;
}
