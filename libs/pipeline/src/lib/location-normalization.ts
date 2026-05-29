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

const NCR = 'National Capital Region';
const METRO_MANILA = 'Metro Manila';
const CEBU_PROVINCE = 'Cebu';
const CENTRAL_VISAYAS = 'Central Visayas';
const WESTERN_VISAYAS = 'Western Visayas';

const LOCATION_ALIASES: {
  city: string;
  province: string;
  region: string;
  patterns: RegExp[];
}[] = [
  // ── Metro Manila (NCR) ────────────────────────────────────────────────────
  {
    city: 'Caloocan',
    province: METRO_MANILA,
    region: NCR,
    patterns: [/\bcaloocan\b/i, /\bkalookan\b/i],
  },
  {
    city: 'Las Piñas',
    province: METRO_MANILA,
    region: NCR,
    patterns: [/\blas\s+pi[nñ]as\b/i],
  },
  {
    city: 'Makati',
    province: METRO_MANILA,
    region: NCR,
    patterns: [/\bmakati\b/i],
  },
  {
    city: 'Malabon',
    province: METRO_MANILA,
    region: NCR,
    patterns: [/\bmalabon\b/i],
  },
  {
    city: 'Mandaluyong',
    province: METRO_MANILA,
    region: NCR,
    patterns: [/\bmandaluyong\b/i],
  },
  {
    city: 'Manila',
    province: METRO_MANILA,
    region: NCR,
    patterns: [/\bcity\s+of\s+manila\b/i, /\bmanila\b/i],
  },
  {
    city: 'Marikina',
    province: METRO_MANILA,
    region: NCR,
    patterns: [/\bmarikina\b/i],
  },
  {
    city: 'Muntinlupa',
    province: METRO_MANILA,
    region: NCR,
    patterns: [/\bmuntinlupa\b/i, /\balaminos\b.*\bmuntinlupa\b/i],
  },
  {
    city: 'Navotas',
    province: METRO_MANILA,
    region: NCR,
    patterns: [/\bnavotas\b/i],
  },
  {
    city: 'Parañaque',
    province: METRO_MANILA,
    region: NCR,
    patterns: [/\bpara[nñ]aque\b/i],
  },
  {
    city: 'Pasay',
    province: METRO_MANILA,
    region: NCR,
    patterns: [/\bpasay\b/i],
  },
  {
    city: 'Pasig',
    province: METRO_MANILA,
    region: NCR,
    patterns: [/\bpasig\b/i],
  },
  {
    city: 'Quezon City',
    province: METRO_MANILA,
    region: NCR,
    // "QC" alone is too ambiguous; require city context or standalone QC
    patterns: [/\bquezon\s+city\b/i, /\bq\.?c\.?\b/i],
  },
  {
    city: 'San Juan',
    province: METRO_MANILA,
    region: NCR,
    // "San Juan" is common elsewhere; only match with Metro Manila context
    patterns: [/\bsan\s+juan\b(?:.*metro\s+manila|.*ncr|.*manila)?/i],
  },
  {
    // Taguig / BGC — match BGC first so it doesn't fall through to other cities
    city: 'Taguig',
    province: METRO_MANILA,
    region: NCR,
    patterns: [
      /\bbonifacio\s+global\s+city\b/i,
      /\bBGC\b/,
      /\btaguig\b/i,
      /\bfort\s+bonifacio\b/i,
    ],
  },
  {
    city: 'Valenzuela',
    province: METRO_MANILA,
    region: NCR,
    patterns: [/\bvalenzuela\b/i],
  },
  {
    city: 'Pateros',
    province: METRO_MANILA,
    region: NCR,
    patterns: [/\bpateros\b/i],
  },

  // ── Cebu Metro ───────────────────────────────────────────────────────────
  {
    city: 'Cebu City',
    province: CEBU_PROVINCE,
    region: CENTRAL_VISAYAS,
    patterns: [/\bcebu\s+city\b/i, /\bcebu\b/i],
  },
  {
    city: 'Mandaue',
    province: CEBU_PROVINCE,
    region: CENTRAL_VISAYAS,
    patterns: [/\bmandaue\b/i],
  },
  {
    city: 'Lapu-Lapu',
    province: CEBU_PROVINCE,
    region: CENTRAL_VISAYAS,
    patterns: [/\blapu[-\s]lapu\b/i, /\bmactan\b/i],
  },
  {
    city: 'Talisay',
    province: CEBU_PROVINCE,
    region: CENTRAL_VISAYAS,
    patterns: [/\btalisay\b(?:.*cebu)?/i],
  },
  {
    city: 'Consolacion',
    province: CEBU_PROVINCE,
    region: CENTRAL_VISAYAS,
    patterns: [/\bconsolacion\b(?:.*cebu)?/i],
  },

  // ── Iloilo ───────────────────────────────────────────────────────────────
  {
    city: 'Iloilo City',
    province: 'Iloilo',
    region: WESTERN_VISAYAS,
    patterns: [/\biloilo\s+city\b/i, /\biloilo\b/i],
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
    // If AI suggested a Metro Manila city but we couldn't verify it in the text,
    // warn — never auto-assign Metro Manila without evidence.
    if (
      input.aiProvince === METRO_MANILA ||
      input.aiCity === 'Manila' ||
      input.aiCity === 'Makati' ||
      input.aiCity === 'Quezon City' ||
      input.aiCity === 'Taguig'
    ) {
      issues.push(
        `AI suggested ${input.aiCity ?? input.aiProvince} without source evidence`,
      );
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

  // Flag if AI city doesn't match AND they're not in the same province.
  // This allows "Makati" vs "Metro Manila" to agree without an issue.
  if (
    input.aiCity &&
    input.aiCity !== match.city &&
    input.aiProvince !== match.province
  ) {
    issues.push(
      `AI city "${input.aiCity}" contradicted explicit source city "${match.city}"`,
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
