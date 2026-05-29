export type LocationConfidence = 'high' | 'medium' | 'low' | 'missing';

export interface LocationNormalizationInput {
  title: string | null;
  body: string | null;
  rawLocation: string | null;
  aiCity: string | null;
  aiProvince: string | null;
}

export interface LocationNormalizationResult {
  raw: string | null;
  city: string | null;
  province: string | null;
  region: string | null;
  status: LocationConfidence;
  evidence: string | null;
  issues: string[];
}

const LOCATION_ALIASES: {
  city: string;
  province: string;
  region: string;
  patterns: RegExp[];
}[] = [
  {
    city: 'Iloilo City',
    province: 'Iloilo',
    region: 'Western Visayas',
    patterns: [/\biloilo\s+city\b/i, /\biloilo\b/i],
  },
  {
    city: 'Manila',
    province: 'Metro Manila',
    region: 'National Capital Region',
    patterns: [/\bmanila\b/i],
  },
  {
    city: 'Cebu City',
    province: 'Cebu',
    region: 'Central Visayas',
    patterns: [/\bcebu\s+city\b/i],
  },
  {
    city: 'Mandaue',
    province: 'Cebu',
    region: 'Central Visayas',
    patterns: [/\bmandaue\b/i],
  },
  {
    city: 'Lapu-Lapu',
    province: 'Cebu',
    region: 'Central Visayas',
    patterns: [/\blapu[-\s]lapu\b/i],
  },
];

export function normalizePhilippineLocation(
  input: LocationNormalizationInput,
): LocationNormalizationResult {
  const issues: string[] = [];
  const prioritizedText = [
    input.title ?? '',
    input.body ?? '',
    input.rawLocation ?? '',
  ].join('\n');

  const match = findFirstExplicitLocation(prioritizedText);
  if (!match) {
    if (input.aiCity === 'Manila' || input.aiProvince === 'Metro Manila') {
      issues.push('AI suggested Manila without source evidence');
    }
    issues.push('No reliable source location found');
    return {
      raw: input.rawLocation,
      city: null,
      province: null,
      region: null,
      status: 'missing',
      evidence: null,
      issues,
    };
  }

  if (input.aiCity && input.aiCity !== match.city) {
    issues.push(
      `AI city ${input.aiCity} contradicted explicit source city ${match.city}`,
    );
  }

  if (/manila/i.test(prioritizedText) && match.city !== 'Manila') {
    issues.push(
      'Found other location mention Manila outside selected property location',
    );
  }

  return {
    raw: input.rawLocation,
    city: match.city,
    province: match.province,
    region: match.region,
    status: issues.length > 0 ? 'medium' : 'high',
    evidence: match.evidence,
    issues,
  };
}

function findFirstExplicitLocation(text: string): {
  city: string;
  province: string;
  region: string;
  evidence: string;
} | null {
  const windows = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of windows) {
    for (const location of LOCATION_ALIASES) {
      if (location.patterns.some((pattern) => pattern.test(line))) {
        return {
          city: location.city,
          province: location.province,
          region: location.region,
          evidence: line.slice(0, 240),
        };
      }
    }
  }

  return null;
}
