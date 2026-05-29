# Normalize Scraped Data Before AVM Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Insert a verified scrape -> AI extraction -> normalization -> validation step before enrichment and AVM training, and prevent Philippine listing locations such as Iloilo from being silently rewritten to Manila.

**Architecture:** Keep the existing NestJS controller -> service -> repository pattern and Bull v4 queues, but centralize Bull root config in a shared queue module before adding new queues. Scraping creates raw pending records, normalization updates those records into train-safe structured records, enrichment creates approved `Property` rows only from normalized records, and AVM retraining uses only normalized/enriched `Property` rows.

**Tech Stack:** NestJS 11, Next.js 16, Prisma/PostgreSQL/PostGIS, Redis/Bull v4 via `@nestjs/bull`, Python FastAPI sidecar, Jest, Zod for untrusted AI output validation, AI/ML API chat completions over `https://api.aimlapi.com/v1/chat/completions`.

---

## Ground Rules For The Intern

- Do not implement outside this plan unless the current code makes a listed step impossible.
- Do not commit unless the project owner explicitly asks. The repo instructions prohibit commits without explicit permission.
- Use PowerShell if WSL still lacks `node` and `rg`. WSL inspection failed in this environment because `node` and `rg` were unavailable.
- Use Nx for validation commands, for example `pnpm nx test pipeline`, `pnpm nx test @gavai/nest`, `pnpm nx typecheck @gavai/nest`, and `pnpm nx typecheck @gavai/web`.
- If CodeGraph is needed, initialize it only after asking the owner. It was not initialized during plan creation.
- Do not add a low-confidence override path in this plan. Low-confidence records must stay visible to admins but must not become trainable.
- Do not backfill legacy `Property` rows in this plan. Existing rows without `sourceRecordId` are excluded from AVM training by default.
- Do not implement real PDF rendering in this plan. The report API should return correct normalized listing/comparable data and warnings; PDF rendering is an explicit follow-up.

## External API Notes

AI/ML API supports OpenAI-compatible chat completion calls. The docs show `base_url="https://api.aimlapi.com/v1"` and chat completions with model and messages. The quickstart also documents direct REST calls to `https://api.aimlapi.com/v1/chat/completions` using `Authorization: Bearer <YOUR_AIMLAPI_KEY>`, `Content-Type: application/json`, `model`, `messages`, `temperature`, and `max_tokens`.

The function-calling docs say function calling can extract structured data, but also warn that model output may hallucinate parameters. That means the app must validate all AI output locally with a runtime schema and must never trust AI location fields without source evidence.

References:

- https://docs.aimlapi.com/
- https://docs.aimlapi.com/quickstart/simple-model
- https://docs.aimlapi.com/capabilities/function-calling
- https://docs.aimlapi.com/capabilities/completion-or-chat-models

## Current Flow Found In Code

Backend pipeline:

- `apps/gavai/nest/src/modules/pipeline/pipeline.controller.ts`
  - `POST /admin/discover` calls `PipelineService.discover`.
  - `POST /admin/discover/approve` marks targets as `queued`.
  - `POST /admin/scrape/run` queues `scrape-url` jobs.
  - `POST /admin/scrape/approve` marks records approved and queues `enrich-record`.
- `apps/gavai/nest/src/modules/pipeline/pipeline.service.ts`
  - Uses queues named `scraping` and `enrichment`.
  - There is no normalization queue today.
  - `approveScrapeRecords` queues enrichment immediately after admin approval.
- `apps/gavai/nest/src/modules/pipeline/scraping.processor.ts`
  - Calls `BrightDataService.scrape`.
  - Converts raw result directly to `PendingTrainingRecord` fields.
  - Sets status to `pending_review`.
- `apps/gavai/nest/src/modules/pipeline/enrichment.processor.ts`
  - Reads approved `PendingTrainingRecord`.
  - Geocodes with Google Maps.
  - Creates approved `Property`.
- `apps/gavai/nest/src/modules/valuation/valuation.repository.ts`
  - `getTrainingRecords` reads approved standard `Property` rows directly.
  - It does not check whether the data came from a normalized record.
- `apps/gavai/nest/src/modules/valuation/valuation.service.ts`
  - `triggerRetrain` synchronously posts all records to sidecar `/api/v1/admin/retrain`.
  - Long-running retraining is currently blocking the request.

Frontend admin flow:

- `apps/gavai/web/src/app/admin/layout.tsx`
  - Shows `Discover`, `Scrape`, and `Model`.
- `apps/gavai/web/src/app/admin/discover/page.tsx`
  - Searches and approves discovered URLs.
- `apps/gavai/web/src/app/admin/scrape/page.tsx`
  - Runs scrape, displays scraped records, approves or rejects them.
  - Queue status only includes `scraping` and `enrichment`.
- `apps/gavai/web/src/app/admin/model/page.tsx`
  - Displays training pool and triggers retraining directly.

Maps/report flow:

- `apps/gavai/web/src/app/map/page.tsx`
  - Map click in valuation mode calls `/valuation`.
  - Report generation sends only `valuationId` to `/report/generate`.
- `apps/gavai/nest/src/modules/report/report.service.ts`
  - Report generation only verifies the valuation and creates a `Report` row with `pdfUrl = null`.
  - It does not attach normalized listings, comparables, area data, or data sufficiency warnings.
- `apps/gavai/nest/src/modules/area/area.service.ts`
  - Area intelligence currently uses BrightData article discovery and Gemini summarization.

Likely Iloilo -> Manila bug:

- `apps/gavai/nest/src/modules/pipeline/services/brightdata.service.ts`
  - `parseListingHtml` scans the full page HTML with a `phCities` array.
  - `manila` appears before `iloilo`.
  - The first city whose text appears anywhere in the full HTML wins.
  - This can select Manila from navigation/footer/SEO text even when the actual listing is in Iloilo.

## Target Data Flow

```text
Discover target
  -> scrape-url job
  -> create PendingTrainingRecord with raw scraped fields and rawTextReference
  -> normalize-record job
  -> AI extraction where available
  -> deterministic normalization and validation
  -> PendingTrainingRecord normalizationStatus = normalized | low_confidence | failed
  -> admin review/approve normalized records
  -> enrich-record job
  -> Property created with sourceRecordId and normalizationConfidenceScore
  -> train-avm job reads only normalized approved standard Property rows with sourceRecordId
  -> report API can fetch valuation + normalized comparables + articles + warnings
  -> future PDF renderer can use the report API payload
```

## File Map

Create:

- `libs/pipeline/src/lib/location-normalization.ts`
- `libs/pipeline/src/lib/location-normalization.spec.ts`
- `libs/pipeline/src/lib/normalization.ts`
- `libs/pipeline/src/lib/normalization.spec.ts`
- `apps/gavai/nest/src/modules/pipeline/services/aimlapi-extraction.service.ts`
- `apps/gavai/nest/src/modules/pipeline/services/aimlapi-extraction.service.spec.ts`
- `apps/gavai/nest/src/modules/pipeline/normalization.processor.ts`
- `apps/gavai/nest/src/modules/pipeline/normalization.processor.spec.ts`
- `apps/gavai/nest/src/modules/queue/queue.module.ts`
- `apps/gavai/nest/src/modules/queue/queue.module.spec.ts`
- `apps/gavai/nest/src/modules/valuation/training.processor.ts`
- `apps/gavai/nest/src/modules/valuation/training.processor.spec.ts`
- `apps/gavai/nest/src/modules/valuation/valuation.module.spec.ts`
- `apps/gavai/nest/src/modules/report/report.service.spec.ts`
- `apps/gavai/web/src/app/admin/normalize/page.tsx`
- `apps/gavai/web/specs/admin-normalize.spec.tsx`
- `libs/platform/prisma/migrations/20260528150000_normalization_pipeline/migration.sql`

Modify:

- `libs/platform/prisma/schema.prisma`
- `libs/pipeline/src/index.ts`
- `apps/gavai/nest/package.json`
- `apps/gavai/nest/src/config/env.validation.ts`
- `.env.example`
- `apps/gavai/nest/src/app/app.module.ts`
- `apps/gavai/nest/src/modules/pipeline/pipeline.module.ts`
- `apps/gavai/nest/src/modules/pipeline/pipeline.controller.ts`
- `apps/gavai/nest/src/modules/pipeline/pipeline.service.ts`
- `apps/gavai/nest/src/modules/pipeline/pipeline.repository.ts`
- `apps/gavai/nest/src/modules/pipeline/scraping.processor.ts`
- `apps/gavai/nest/src/modules/pipeline/enrichment.processor.ts`
- `apps/gavai/nest/src/modules/pipeline/services/brightdata.service.ts`
- `apps/gavai/nest/src/modules/admin/admin.controller.ts`
- `apps/gavai/nest/src/modules/admin/admin.module.ts`
- `apps/gavai/nest/src/modules/valuation/valuation.module.ts`
- `apps/gavai/nest/src/modules/valuation/valuation.service.ts`
- `apps/gavai/nest/src/modules/valuation/valuation.repository.ts`
- `apps/gavai/nest/src/modules/report/report.repository.ts`
- `apps/gavai/nest/src/modules/report/report.service.ts`
- `apps/gavai/web/src/app/admin/layout.tsx`
- `apps/gavai/web/src/app/admin/model/page.tsx`
- `apps/gavai/web/src/app/admin/scrape/page.tsx`
- `apps/gavai/web/src/types/api.ts`

---

## Task 0: Centralize Bull Queue Root Configuration

**Files:**

- Create: `apps/gavai/nest/src/modules/queue/queue.module.ts`
- Create: `apps/gavai/nest/src/modules/queue/queue.module.spec.ts`
- Modify: `apps/gavai/nest/src/modules/pipeline/pipeline.module.ts`
- Modify: `apps/gavai/nest/src/app/app.module.ts`

- [ ] **Step 1: Write the queue module compile test**

Create `apps/gavai/nest/src/modules/queue/queue.module.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { QueueModule } from './queue.module';

describe('QueueModule', () => {
  it('compiles with REDIS_URL from config', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              REDIS_URL: 'redis://localhost:6379',
            }),
          ],
        }),
        QueueModule,
      ],
    }).compile();

    expect(moduleRef).toBeDefined();
  });
});
```

- [ ] **Step 2: Run red**

Run:

```bash
pnpm nx test @gavai/nest --testFile=src/modules/queue/queue.module.spec.ts
```

Expected: fail because `QueueModule` does not exist.

- [ ] **Step 3: Create the shared queue module**

Create `apps/gavai/nest/src/modules/queue/queue.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = new URL(configService.getOrThrow<string>('REDIS_URL'));
        return {
          redis: {
            host: redisUrl.hostname,
            port: Number(redisUrl.port) || 6379,
            password:
              redisUrl.password ||
              configService.get<string>('REDIS_PASSWORD') ||
              undefined,
          },
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
```

- [ ] **Step 4: Remove duplicate Bull root config from PipelineModule**

Modify `apps/gavai/nest/src/modules/pipeline/pipeline.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from '../auth/auth.module';
import { QueueModule } from '../queue/queue.module';
```

Delete `ConfigModule`, `ConfigService`, and `BullModule.forRootAsync(...)` from this module. Keep queue registration local:

```typescript
imports: [
  AuthModule,
  QueueModule,
  BullModule.registerQueue({ name: 'scraping' }, { name: 'enrichment' }),
],
```

- [ ] **Step 5: Import QueueModule once in AppModule**

Modify `apps/gavai/nest/src/app/app.module.ts`:

```typescript
import { QueueModule } from '../modules/queue/queue.module';
```

Add `QueueModule` to the `imports` array after `AuthModule`. This ensures root queue config is initialized before feature modules register queues.

- [ ] **Step 6: Run green**

Run:

```bash
pnpm nx test @gavai/nest --testFile=src/modules/queue/queue.module.spec.ts
pnpm nx typecheck @gavai/nest
```

Expected: pass. If importing `QueueModule` both in `AppModule` and feature modules causes duplicate provider warnings, keep `QueueModule` in `AppModule` and import it only in modules that need access to exported `BullModule`; do not re-add `BullModule.forRootAsync` to feature modules.

## Task 1: Add Deterministic Location Normalization In `libs/pipeline`

**Files:**

- Create: `libs/pipeline/src/lib/location-normalization.ts`
- Create: `libs/pipeline/src/lib/location-normalization.spec.ts`
- Modify: `libs/pipeline/src/index.ts`

- [ ] **Step 1: Write the failing location tests**

Create `libs/pipeline/src/lib/location-normalization.spec.ts`:

```typescript
import { normalizePhilippineLocation } from './location-normalization';

describe('normalizePhilippineLocation', () => {
  it('preserves Iloilo City and province from explicit property text', () => {
    const result = normalizePhilippineLocation({
      title: 'Residential lot for sale in Iloilo City',
      body: 'Property located in Iloilo City near schools.',
      aiCity: 'Manila',
      aiProvince: 'Metro Manila',
      rawLocation: 'Iloilo City',
    });

    expect(result.city).toBe('Iloilo City');
    expect(result.province).toBe('Iloilo');
    expect(result.status).toBe('high');
    expect(result.issues).toContain(
      'AI city Manila contradicted explicit source city Iloilo City',
    );
  });

  it('does not default missing location to Manila', () => {
    const result = normalizePhilippineLocation({
      title: 'Residential lot for sale, near commercial area',
      body: 'Clean title. Near schools and shops.',
      aiCity: null,
      aiProvince: null,
      rawLocation: null,
    });

    expect(result.city).toBeNull();
    expect(result.province).toBeNull();
    expect(result.status).toBe('missing');
    expect(result.issues).toContain('No reliable source location found');
  });

  it('prefers property body location over unrelated Manila text', () => {
    const result = normalizePhilippineLocation({
      title: 'Residential lot for sale in Iloilo City',
      body: 'Property details: located in Iloilo City. Broker office: Manila.',
      aiCity: 'Manila',
      aiProvince: 'Metro Manila',
      rawLocation: 'Manila',
    });

    expect(result.city).toBe('Iloilo City');
    expect(result.province).toBe('Iloilo');
    expect(result.status).toBe('high');
    expect(result.issues).toContain(
      'Found other location mention Manila outside selected property location',
    );
  });
});
```

- [ ] **Step 2: Run the test and verify red**

Run:

```bash
pnpm nx test pipeline --testFile=src/lib/location-normalization.spec.ts
```

Expected: fail because `location-normalization.ts` does not exist.

- [ ] **Step 3: Implement the minimal deterministic normalizer**

Create `libs/pipeline/src/lib/location-normalization.ts`:

```typescript
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
```

- [ ] **Step 4: Export it**

Modify `libs/pipeline/src/index.ts`:

```typescript
export * from './lib/pipeline';
export * from './lib/area-key';
export * from './lib/location-normalization';
```

- [ ] **Step 5: Run green**

Run:

```bash
pnpm nx test pipeline --testFile=src/lib/location-normalization.spec.ts
```

Expected: pass. If the first test returns `medium` instead of `high` because contradiction issues exist, keep `medium` and update only the assertion to `toBe('medium')`. The important behavior is preserving Iloilo and recording the contradiction.

## Task 2: Add Normalized Listing Types And Validation

**Files:**

- Create: `libs/pipeline/src/lib/normalization.ts`
- Create: `libs/pipeline/src/lib/normalization.spec.ts`
- Modify: `libs/pipeline/src/index.ts`

- [ ] **Step 1: Write validation tests**

Create `libs/pipeline/src/lib/normalization.spec.ts`:

```typescript
import { normalizeExtractedListing } from './normalization';

describe('normalizeExtractedListing', () => {
  it('marks records with explicit Iloilo location as normalized', () => {
    const result = normalizeExtractedListing({
      sourceUrl: 'https://example.com/iloilo-lot',
      sourceName: 'example',
      title: 'Residential lot for sale in Iloilo City',
      description: 'Property located in Iloilo City.',
      rawTextReference: 'Residential lot for sale in Iloilo City. PHP 2500000.',
      extracted: {
        title: 'Residential lot for sale in Iloilo City',
        description: 'Property located in Iloilo City.',
        location: {
          raw: 'Iloilo City',
          city: 'Iloilo City',
          province: 'Iloilo',
          confidence: 'high',
          evidence: 'located in Iloilo City',
        },
        propertyType: { value: 'residential_lot', confidence: 'high' },
        price: { value: 2500000, currency: 'PHP', confidence: 'high' },
        lotArea: { value: 120, unit: 'sqm', confidence: 'high' },
        floorArea: { value: null, unit: 'sqm', confidence: 'missing' },
        issues: [],
      },
    });

    expect(result.normalizationStatus).toBe('normalized');
    expect(result.city).toBe('Iloilo City');
    expect(result.province).toBe('Iloilo');
    expect(result.askingPricePhp).toBe(2500000);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.8);
  });

  it('does not train records without reliable location', () => {
    const result = normalizeExtractedListing({
      sourceUrl: 'https://example.com/no-location',
      sourceName: 'example',
      title: 'Residential lot for sale, near commercial area',
      description: 'Clean title.',
      rawTextReference: 'Residential lot for sale, near commercial area.',
      extracted: {
        title: 'Residential lot for sale, near commercial area',
        description: 'Clean title.',
        location: {
          raw: null,
          city: null,
          province: null,
          confidence: 'missing',
          evidence: null,
        },
        propertyType: { value: 'residential_lot', confidence: 'medium' },
        price: { value: null, currency: 'PHP', confidence: 'missing' },
        lotArea: { value: null, unit: 'sqm', confidence: 'missing' },
        floorArea: { value: null, unit: 'sqm', confidence: 'missing' },
        issues: [],
      },
    });

    expect(result.normalizationStatus).toBe('failed');
    expect(result.city).toBeNull();
    expect(result.trainingEligible).toBe(false);
    expect(result.normalizationIssues).toContain(
      'No reliable source location found',
    );
    expect(result.normalizationIssues).toContain('Missing price');
  });
});
```

- [ ] **Step 2: Run red**

Run:

```bash
pnpm nx test pipeline --testFile=src/lib/normalization.spec.ts
```

Expected: fail because implementation does not exist.

- [ ] **Step 3: Implement normalization contracts**

Create `libs/pipeline/src/lib/normalization.ts`:

```typescript
import {
  LocationConfidence,
  normalizePhilippineLocation,
} from './location-normalization';

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
  const confidenceScore = computeConfidenceScore([
    input.extracted.location.confidence,
    input.extracted.propertyType.confidence,
    input.extracted.price.confidence,
    input.extracted.lotArea.confidence,
    input.extracted.floorArea.confidence,
  ]);

  const normalizationStatus: NormalizationStatus = hardFailure
    ? 'failed'
    : confidenceScore < 0.7 || location.status === 'low'
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

function computeConfidenceScore(values: FieldConfidence[]): number {
  const weights: Record<FieldConfidence, number> = {
    high: 1,
    medium: 0.75,
    low: 0.35,
    missing: 0,
  };
  const score =
    values.reduce((sum, value) => sum + weights[value], 0) / values.length;
  return Math.round(score * 100) / 100;
}
```

- [ ] **Step 4: Export it**

Modify `libs/pipeline/src/index.ts`:

```typescript
export * from './lib/pipeline';
export * from './lib/area-key';
export * from './lib/location-normalization';
export * from './lib/normalization';
```

- [ ] **Step 5: Run green**

Run:

```bash
pnpm nx test pipeline --testFile=src/lib/location-normalization.spec.ts
pnpm nx test pipeline --testFile=src/lib/normalization.spec.ts
```

Expected: both pass.

## Task 3: Extend Prisma Schema For Raw, Normalized, And Training Gate Fields

**Files:**

- Modify: `libs/platform/prisma/schema.prisma`
- Create: `libs/platform/prisma/migrations/20260528150000_normalization_pipeline/migration.sql`

- [ ] **Step 1: Update schema**

Modify `PendingTrainingRecord` and `Property` in `libs/platform/prisma/schema.prisma`:

```prisma
model Property {
  id                           String     @id @default(cuid())
  sourceRecordId               String?    @unique
  sourceRecord                 PendingTrainingRecord? @relation(fields: [sourceRecordId], references: [id])
  sourceUrl                    String?
  scrapedAt                    DateTime
  rawTitle                     String?
  addressRaw                   String?
  googlePlaceId                String?
  city                         String?
  province                     String?
  region                       String?
  barangay                     String?
  lat                          Float?
  lng                          Float?
  propertyType                 String
  listingType                  String     @default("standard")
  lotAreaSqm                   Float?
  floorAreaSqm                 Float?
  bedrooms                     Int?
  bathrooms                    Int?
  buildingAgeYears             Int?
  developer                    String?
  askingPricePhp               Float
  pricePerSqmPhp               Float?
  listingDate                  DateTime?
  zonalValuePhp                Float?
  landClassification           String?
  proximityScores              Json?
  phivolcsRisk                 Float?
  floodRisk                    Float?
  crepTier                     String?
  crepPhp                      Float?
  normalizationConfidenceScore Float?
  normalizationIssues          Json?
  userSubmitted                Boolean    @default(false)
  approved                     Boolean    @default(false)
  createdAt                    DateTime   @default(now())
  updatedAt                    DateTime   @updatedAt
  valuations                   Valuation[]

  @@index([lat, lng])
  @@index([barangay, city])
  @@index([province])
  @@index([propertyType])
  @@index([googlePlaceId])
  @@index([listingType])
}

model ModelVersion {
  id              String    @id @default(cuid())
  version         String    @unique
  modelPath       String
  status          String    // training | ready | deployed | archived | failed
  mape            Float?
  trainingRecords Int?
  jobId           String?
  errorLog        String?
  deployedAt      DateTime?
  createdAt       DateTime  @default(now())
}

model PendingTrainingRecord {
  id                  String    @id @default(cuid())
  sourceUrl           String?
  sourceName          String?
  status              String
  title               String?
  description         String?
  addressRaw          String?
  locationRaw         String?
  city                String?
  province            String?
  region              String?
  barangay            String?
  propertyType        String?
  lotAreaSqm          Float?
  floorAreaSqm        Float?
  bedrooms            Int?
  bathrooms           Int?
  askingPricePhp      Float?
  pricePerSqmPhp      Float?
  listingDate         DateTime?
  developer           String?
  rawTextReference    String?
  aiExtraction        Json?
  fieldConfidence     Json?
  confidenceScore     Float?
  locationStatus      String?
  normalizationStatus String    @default("pending")
  normalizationIssues Json?
  normalizedAt        DateTime?
  trainingEligible    Boolean   @default(false)
  flagged             Boolean   @default(false)
  flagReason          String?
  createdAt           DateTime  @default(now())
  property            Property?

  @@index([status])
  @@index([normalizationStatus])
  @@index([trainingEligible])
  @@index([city, province])
}
```

Keep every existing field that is currently used. Add only the listed fields.

- [ ] **Step 2: Generate migration**

Run:

```bash
pnpm nx run @gavai/platform:prisma-migrate -- --name normalization_pipeline
```

Expected: Prisma creates a migration and regenerates the client. If the local DB is not available, create a SQL migration manually with the same fields and run `pnpm nx run @gavai/platform:prisma-generate`.

- [ ] **Step 3: Manual migration SQL if DB is unavailable**

Use this SQL in the generated migration file:

```sql
ALTER TABLE "PendingTrainingRecord"
  ADD COLUMN "sourceName" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "locationRaw" TEXT,
  ADD COLUMN "province" TEXT,
  ADD COLUMN "region" TEXT,
  ADD COLUMN "rawTextReference" TEXT,
  ADD COLUMN "aiExtraction" JSONB,
  ADD COLUMN "fieldConfidence" JSONB,
  ADD COLUMN "confidenceScore" DOUBLE PRECISION,
  ADD COLUMN "locationStatus" TEXT,
  ADD COLUMN "normalizationStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "normalizationIssues" JSONB,
  ADD COLUMN "normalizedAt" TIMESTAMP(3),
  ADD COLUMN "trainingEligible" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Property"
  ADD COLUMN "sourceRecordId" TEXT,
  ADD COLUMN "province" TEXT,
  ADD COLUMN "region" TEXT,
  ADD COLUMN "normalizationConfidenceScore" DOUBLE PRECISION,
  ADD COLUMN "normalizationIssues" JSONB;

ALTER TABLE "ModelVersion"
  ADD COLUMN "errorLog" TEXT;

CREATE UNIQUE INDEX "Property_sourceRecordId_key" ON "Property"("sourceRecordId");
CREATE INDEX "PendingTrainingRecord_status_idx" ON "PendingTrainingRecord"("status");
CREATE INDEX "PendingTrainingRecord_normalizationStatus_idx" ON "PendingTrainingRecord"("normalizationStatus");
CREATE INDEX "PendingTrainingRecord_trainingEligible_idx" ON "PendingTrainingRecord"("trainingEligible");
CREATE INDEX "PendingTrainingRecord_city_province_idx" ON "PendingTrainingRecord"("city", "province");
CREATE INDEX "Property_province_idx" ON "Property"("province");

ALTER TABLE "Property"
  ADD CONSTRAINT "Property_sourceRecordId_fkey"
  FOREIGN KEY ("sourceRecordId") REFERENCES "PendingTrainingRecord"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 4: Validate Prisma**

Run:

```bash
pnpm nx run @gavai/platform:prisma-generate
pnpm nx typecheck @gavai/platform
```

Expected: both pass.

## Task 4: Add AI/ML API Extraction Service With Strict JSON Parsing

**Files:**

- Create: `apps/gavai/nest/src/modules/pipeline/services/aimlapi-extraction.service.ts`
- Create: `apps/gavai/nest/src/modules/pipeline/services/aimlapi-extraction.service.spec.ts`
- Modify: `apps/gavai/nest/package.json`
- Modify: `.env.example`
- Modify: `apps/gavai/nest/src/config/env.validation.ts`
- Modify: `apps/gavai/nest/src/modules/pipeline/pipeline.module.ts`

- [ ] **Step 1: Add Zod to the Nest package**

Modify `apps/gavai/nest/package.json` dependencies:

```json
"zod": "^4.4.3"
```

Run:

```bash
pnpm install
```

Expected: lockfile updates successfully. This dependency is justified because AI/ML API output is untrusted runtime data and compile-time TypeScript types cannot validate it.

- [ ] **Step 2: Write strict parser tests**

Create `apps/gavai/nest/src/modules/pipeline/services/aimlapi-extraction.service.spec.ts`:

```typescript
import { AimlapiExtractionService } from './aimlapi-extraction.service';

describe('AimlapiExtractionService JSON validation', () => {
  const service = new AimlapiExtractionService({
    get: jest.fn(),
  } as never);

  it('rejects malformed confidence values instead of silently accepting them', () => {
    const result = service.parseExtractedJsonForTest(
      JSON.stringify({
        title: 'Lot in Iloilo City',
        description: 'Residential lot in Iloilo City',
        location: {
          raw: 'Iloilo City',
          city: 'Iloilo City',
          province: 'Iloilo',
          confidence: 'certain',
          evidence: 'Iloilo City',
        },
        propertyType: { value: 'residential_lot', confidence: 'high' },
        price: { value: 2500000, currency: 'PHP', confidence: 'high' },
        lotArea: { value: 120, unit: 'sqm', confidence: 'high' },
        floorArea: { value: null, unit: 'sqm', confidence: 'missing' },
        issues: [],
      }),
    );

    expect(result).toBeNull();
  });

  it('rejects extra unrecognized top-level fields from AI output', () => {
    const result = service.parseExtractedJsonForTest(
      JSON.stringify({
        title: 'Lot in Iloilo City',
        description: 'Residential lot in Iloilo City',
        location: {
          raw: 'Iloilo City',
          city: 'Iloilo City',
          province: 'Iloilo',
          confidence: 'high',
          evidence: 'Iloilo City',
        },
        propertyType: { value: 'residential_lot', confidence: 'high' },
        price: { value: 2500000, currency: 'PHP', confidence: 'high' },
        lotArea: { value: 120, unit: 'sqm', confidence: 'high' },
        floorArea: { value: null, unit: 'sqm', confidence: 'missing' },
        issues: [],
        inventedNeighborhoodScore: 999,
      }),
    );

    expect(result).toBeNull();
  });

  it('accepts valid structured extraction JSON', () => {
    const result = service.parseExtractedJsonForTest(
      JSON.stringify({
        title: 'Lot in Iloilo City',
        description: 'Residential lot in Iloilo City',
        location: {
          raw: 'Iloilo City',
          city: 'Iloilo City',
          province: 'Iloilo',
          confidence: 'high',
          evidence: 'Iloilo City',
        },
        propertyType: { value: 'residential_lot', confidence: 'high' },
        price: { value: 2500000, currency: 'PHP', confidence: 'high' },
        lotArea: { value: 120, unit: 'sqm', confidence: 'high' },
        floorArea: { value: null, unit: 'sqm', confidence: 'missing' },
        issues: [],
      }),
    );

    expect(result?.location.city).toBe('Iloilo City');
  });
});
```

Expose `parseExtractedJsonForTest` as a public method that delegates to the private parser. Do not use it outside tests.

- [ ] **Step 3: Run red**

Run:

```bash
pnpm nx test @gavai/nest --testFile=src/modules/pipeline/services/aimlapi-extraction.service.spec.ts
```

Expected: fail because the service does not exist yet.

- [ ] **Step 4: Add environment variables**

Modify `.env.example`:

```dotenv
AIMLAPI_KEY=""
AIMLAPI_MODEL="gpt-4o-mini"
```

Modify `apps/gavai/nest/src/config/env.validation.ts`:

```typescript
export interface EnvConfig {
  DATABASE_URL: string;
  REDIS_URL: string;
  REDIS_PASSWORD?: string;
  ML_SIDECAR_URL: string;
  JWT_SECRET: string;
  JWT_ACCESS_EXPIRY?: string;
  JWT_REFRESH_EXPIRY?: string;
  JWT_REFRESH_SECRET?: string;
  GOOGLE_MAPS_KEY: string;
  BRIGHTDATA_API_KEY: string;
  GEMINI_API_KEY: string;
  AIMLAPI_KEY?: string;
  AIMLAPI_MODEL?: string;
  XENDIT_SECRET_KEY: string;
  XENDIT_WEBHOOK_TOKEN?: string;
  NEXT_PUBLIC_GOOGLE_MAPS_KEY: string;
  WEB_URL?: string;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
  PORT: number;
  NODE_ENV: string;
}
```

Also add `AIMLAPI_MODEL: 'gpt-4o-mini'` to the defaults object. Do not make `AIMLAPI_KEY` required yet because the owner said the key will be provided later.

- [ ] **Step 5: Create extraction service with strict Zod validation**

Create `apps/gavai/nest/src/modules/pipeline/services/aimlapi-extraction.service.ts`:

````typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { ExtractedListingPayload } from '@gavai/pipeline';

const confidenceSchema = z.enum(['high', 'medium', 'low', 'missing']);

const extractedListingSchema = z
  .object({
    title: z.string().nullable(),
    description: z.string().nullable(),
    location: z
      .object({
        raw: z.string().nullable(),
        city: z.string().nullable(),
        province: z.string().nullable(),
        confidence: confidenceSchema,
        evidence: z.string().nullable(),
      })
      .strict(),
    propertyType: z
      .object({
        value: z.string().nullable(),
        confidence: confidenceSchema,
      })
      .strict(),
    price: z
      .object({
        value: z.number().nullable(),
        currency: z.literal('PHP'),
        confidence: confidenceSchema,
      })
      .strict(),
    lotArea: z
      .object({
        value: z.number().nullable(),
        unit: z.literal('sqm'),
        confidence: confidenceSchema,
      })
      .strict(),
    floorArea: z
      .object({
        value: z.number().nullable(),
        unit: z.literal('sqm'),
        confidence: confidenceSchema,
      })
      .strict(),
    issues: z.array(z.string()),
  })
  .strict();

@Injectable()
export class AimlapiExtractionService {
  private readonly logger = new Logger(AimlapiExtractionService.name);
  private readonly endpoint = 'https://api.aimlapi.com/v1/chat/completions';

  constructor(private readonly configService: ConfigService) {}

  async extractListing(
    rawText: string,
  ): Promise<ExtractedListingPayload | null> {
    const apiKey = this.configService.get<string>('AIMLAPI_KEY');
    if (!apiKey) {
      this.logger.warn(
        'AIMLAPI_KEY is missing; normalization will use deterministic fallback only',
      );
      return null;
    }

    const model =
      this.configService.get<string>('AIMLAPI_MODEL') ?? 'gpt-4o-mini';
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 1200,
        messages: [
          {
            role: 'system',
            content: [
              'You extract Philippine real estate listing fields.',
              'Return JSON only.',
              'Use only facts explicitly present in the source text.',
              'Never guess missing fields.',
              'Never default any location to Manila.',
              'If location is ambiguous or absent, set city and province to null and confidence to missing or low.',
              'Preserve explicit city and province names from the source.',
              'Include short evidence snippets for location and price when possible.',
            ].join(' '),
          },
          {
            role: 'user',
            content: `Extract this listing into the required schema:\n\n${rawText.slice(0, 12000)}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.warn(
        `AI/ML extraction failed ${response.status}: ${body.slice(0, 500)}`,
      );
      return null;
    }

    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;

    return this.parseExtractedJson(content);
  }

  parseExtractedJsonForTest(content: string): ExtractedListingPayload | null {
    return this.parseExtractedJson(content);
  }

  private parseExtractedJson(content: string): ExtractedListingPayload | null {
    const cleaned = content
      .replace(/^```json\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    try {
      const parsed = extractedListingSchema.safeParse(JSON.parse(cleaned));
      if (!parsed.success) {
        this.logger.warn(
          `AI/ML extraction failed schema validation: ${parsed.error.message}`,
        );
        return null;
      }
      return parsed.data;
    } catch {
      this.logger.warn('AI/ML extraction returned invalid JSON');
      return null;
    }
  }
}
````

- [ ] **Step 6: Register service**

Modify `apps/gavai/nest/src/modules/pipeline/pipeline.module.ts`:

```typescript
import { AimlapiExtractionService } from './services/aimlapi-extraction.service';
```

Add `AimlapiExtractionService` to `providers` and `exports`.

- [ ] **Step 7: Run parser tests and typecheck**

Run:

```bash
pnpm nx test @gavai/nest --testFile=src/modules/pipeline/services/aimlapi-extraction.service.spec.ts
pnpm nx typecheck @gavai/nest
```

Expected: both pass. If typecheck fails due generated Prisma client being stale, run `pnpm nx run @gavai/platform:prisma-generate` and rerun.

## Task 5: Create Normalization Queue And Processor

**Files:**

- Create: `apps/gavai/nest/src/modules/pipeline/normalization.processor.ts`
- Create: `apps/gavai/nest/src/modules/pipeline/normalization.processor.spec.ts`
- Modify: `apps/gavai/nest/src/modules/pipeline/pipeline.module.ts`
- Modify: `apps/gavai/nest/src/modules/pipeline/pipeline.service.ts`
- Modify: `apps/gavai/nest/src/modules/pipeline/pipeline.repository.ts`
- Modify: `apps/gavai/nest/src/modules/pipeline/pipeline.controller.ts`

- [ ] **Step 1: Write processor test**

Create `apps/gavai/nest/src/modules/pipeline/normalization.processor.spec.ts`:

```typescript
import { NormalizationProcessor } from './normalization.processor';

describe('NormalizationProcessor', () => {
  it('normalizes Iloilo record and does not keep AI Manila', async () => {
    const repository = {
      findRecordById: jest.fn().mockResolvedValue({
        id: 'rec_1',
        sourceUrl: 'https://example.com/iloilo',
        sourceName: 'example',
        title: 'Residential lot for sale in Iloilo City',
        description: 'Property located in Iloilo City.',
        rawTextReference:
          'Residential lot for sale in Iloilo City. Broker office Manila.',
      }),
      updateRecordNormalization: jest.fn().mockResolvedValue({ id: 'rec_1' }),
    };
    const ai = {
      extractListing: jest.fn().mockResolvedValue({
        title: 'Residential lot for sale in Iloilo City',
        description: 'Property located in Iloilo City.',
        location: {
          raw: 'Manila',
          city: 'Manila',
          province: 'Metro Manila',
          confidence: 'medium',
          evidence: 'Broker office Manila',
        },
        propertyType: { value: 'residential_lot', confidence: 'high' },
        price: { value: 2500000, currency: 'PHP', confidence: 'high' },
        lotArea: { value: 120, unit: 'sqm', confidence: 'high' },
        floorArea: { value: null, unit: 'sqm', confidence: 'missing' },
        issues: [],
      }),
    };

    const processor = new NormalizationProcessor(
      repository as never,
      ai as never,
    );
    await processor.handleNormalize({ data: { recordId: 'rec_1' } } as never);

    expect(repository.updateRecordNormalization).toHaveBeenCalledWith(
      'rec_1',
      expect.objectContaining({
        city: 'Iloilo City',
        province: 'Iloilo',
        normalizationStatus: expect.stringMatching(/normalized|low_confidence/),
      }),
    );
  });
});
```

- [ ] **Step 2: Run red**

Run:

```bash
pnpm nx test @gavai/nest --testFile=src/modules/pipeline/normalization.processor.spec.ts
```

Expected: fail because processor does not exist.

- [ ] **Step 3: Add repository methods**

Modify `apps/gavai/nest/src/modules/pipeline/pipeline.repository.ts` with these methods:

```typescript
async updateRecordNormalization(
  id: string,
  data: {
    title?: string | null;
    description?: string | null;
    locationRaw?: string | null;
    city?: string | null;
    province?: string | null;
    region?: string | null;
    propertyType?: string | null;
    askingPricePhp?: number | null;
    lotAreaSqm?: number | null;
    floorAreaSqm?: number | null;
    rawTextReference?: string | null;
    aiExtraction?: unknown;
    fieldConfidence?: unknown;
    confidenceScore?: number;
    locationStatus?: string;
    normalizationStatus: string;
    normalizationIssues?: unknown;
    normalizedAt: Date;
    trainingEligible: boolean;
    flagged?: boolean;
    flagReason?: string | null;
  },
) {
  return this.prisma.pendingTrainingRecord.update({
    where: { id },
    data,
  });
}

async findNormalizationReviewRecords() {
  return this.prisma.pendingTrainingRecord.findMany({
    where: {
      normalizationStatus: { in: ['normalized', 'low_confidence', 'failed'] },
      status: { in: ['normalization_review', 'normalization_failed'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

async approveNormalizedRecords(ids: string[]) {
  return this.prisma.pendingTrainingRecord.updateMany({
    where: {
      id: { in: ids },
      normalizationStatus: 'normalized',
      trainingEligible: true,
    },
    data: { status: 'approved' },
  });
}
```

- [ ] **Step 4: Add processor**

Create `apps/gavai/nest/src/modules/pipeline/normalization.processor.ts`:

```typescript
import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import {
  ExtractedListingPayload,
  normalizeExtractedListing,
} from '@gavai/pipeline';
import { PipelineRepository } from './pipeline.repository';
import { AimlapiExtractionService } from './services/aimlapi-extraction.service';

@Processor('normalization')
@Injectable()
export class NormalizationProcessor {
  private readonly logger = new Logger(NormalizationProcessor.name);

  constructor(
    private readonly pipelineRepository: PipelineRepository,
    private readonly aimlapiExtraction: AimlapiExtractionService,
  ) {}

  @Process('normalize-record')
  async handleNormalize(
    job: Job<{ recordId: string }>,
  ): Promise<{ recordId: string; status: string }> {
    const record = await this.pipelineRepository.findRecordById(
      job.data.recordId,
    );
    if (!record) return { recordId: job.data.recordId, status: 'missing' };

    const rawTextReference = String(
      record.rawTextReference ??
        [record.title, record.description, record.addressRaw, record.city]
          .filter(Boolean)
          .join('\n'),
    );

    const extracted =
      (await this.aimlapiExtraction.extractListing(rawTextReference)) ??
      fallbackExtraction(record, rawTextReference);

    const normalized = normalizeExtractedListing({
      sourceUrl: record.sourceUrl,
      sourceName: record.sourceName,
      title: record.title,
      description: record.description,
      rawTextReference,
      extracted,
    });

    const flags = [...normalized.normalizationIssues];
    await this.pipelineRepository.updateRecordNormalization(record.id, {
      title: normalized.title,
      description: normalized.description,
      locationRaw: normalized.location,
      city: normalized.city,
      province: normalized.province,
      region: normalized.region,
      propertyType: normalized.propertyType,
      askingPricePhp: normalized.askingPricePhp,
      lotAreaSqm: normalized.lotAreaSqm,
      floorAreaSqm: normalized.floorAreaSqm,
      rawTextReference: normalized.rawTextReference,
      aiExtraction: extracted,
      fieldConfidence: normalized.fieldConfidence,
      confidenceScore: normalized.confidenceScore,
      locationStatus: normalized.locationStatus,
      normalizationStatus: normalized.normalizationStatus,
      normalizationIssues: normalized.normalizationIssues,
      normalizedAt: new Date(),
      trainingEligible: normalized.trainingEligible,
      status:
        normalized.normalizationStatus === 'failed'
          ? 'normalization_failed'
          : 'normalization_review',
      flagged: normalized.normalizationStatus !== 'normalized',
      flagReason: flags.join('; ') || null,
    });

    this.logger.log(
      `Normalized record ${record.id}: city=${normalized.city ?? 'null'} province=${normalized.province ?? 'null'} status=${normalized.normalizationStatus}`,
    );

    return { recordId: record.id, status: normalized.normalizationStatus };
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Normalization job ${job.id} failed: ${error.message}`);
  }
}

function fallbackExtraction(
  record: {
    title: string | null;
    description?: string | null;
    addressRaw: string | null;
    city: string | null;
    propertyType: string | null;
    askingPricePhp: number | null;
    lotAreaSqm: number | null;
    floorAreaSqm: number | null;
  },
  rawTextReference: string,
): ExtractedListingPayload {
  return {
    title: record.title,
    description: record.description ?? null,
    location: {
      raw: record.addressRaw ?? record.city,
      city: record.city,
      province: null,
      confidence: record.city ? 'medium' : 'missing',
      evidence: record.addressRaw ?? null,
    },
    propertyType: {
      value: record.propertyType,
      confidence: record.propertyType ? 'medium' : 'missing',
    },
    price: {
      value: record.askingPricePhp,
      currency: 'PHP',
      confidence: record.askingPricePhp ? 'medium' : 'missing',
    },
    lotArea: {
      value: record.lotAreaSqm,
      unit: 'sqm',
      confidence: record.lotAreaSqm ? 'medium' : 'missing',
    },
    floorArea: {
      value: record.floorAreaSqm,
      unit: 'sqm',
      confidence: record.floorAreaSqm ? 'medium' : 'missing',
    },
    issues: rawTextReference ? [] : ['No raw source text available'],
  };
}
```

- [ ] **Step 5: Register the normalization queue**

Modify `apps/gavai/nest/src/modules/pipeline/pipeline.module.ts`:

```typescript
import { NormalizationProcessor } from './normalization.processor';
import { QueueModule } from '../queue/queue.module';
```

Change queue registration:

```typescript
imports: [
  AuthModule,
  QueueModule,
  BullModule.registerQueue(
    { name: 'scraping' },
    { name: 'normalization' },
    { name: 'enrichment' },
  ),
],
```

Do not add `BullModule.forRootAsync` here. Queue root config must stay in `QueueModule`.

If the existing `imports` array is easier to patch directly, the final queue registration should contain:

```typescript
BullModule.registerQueue(
  { name: 'scraping' },
  { name: 'normalization' },
  { name: 'enrichment' },
),
```

Add `NormalizationProcessor` to providers.

- [ ] **Step 6: Update service and controller endpoints**

Modify constructor in `PipelineService`:

```typescript
@InjectQueue('normalization') private readonly normalizationQueue: Queue,
```

Add methods:

```typescript
async queueNormalizationForRecords(ids: string[]): Promise<{ queued: number }> {
  for (const id of ids) {
    await this.normalizationQueue.add('normalize-record', { recordId: id });
  }
  return { queued: ids.length };
}

async getNormalizationRecords() {
  return this.pipelineRepository.findNormalizationReviewRecords();
}

async approveNormalizedRecords(ids: string[]): Promise<{ approved: number }> {
  const result = await this.pipelineRepository.approveNormalizedRecords(ids);
  for (const id of ids) {
    const record = await this.pipelineRepository.findRecordById(id);
    if (record?.status === 'approved') {
      await this.enrichmentQueue.add('enrich-record', { recordId: record.id });
    }
  }
  return { approved: result.count };
}
```

Update `getQueueStatus` so the admin can see normalization queue work:

```typescript
async getQueueStatus(): Promise<{
  scraping: { active: number; waiting: number };
  normalization: { active: number; waiting: number };
  enrichment: { active: number; waiting: number };
}> {
  const [
    scrapingActive,
    scrapingWaiting,
    normalizationActive,
    normalizationWaiting,
    enrichmentActive,
    enrichmentWaiting,
  ] = await Promise.all([
    this.scrapingQueue.getActiveCount(),
    this.scrapingQueue.getWaitingCount(),
    this.normalizationQueue.getActiveCount(),
    this.normalizationQueue.getWaitingCount(),
    this.enrichmentQueue.getActiveCount(),
    this.enrichmentQueue.getWaitingCount(),
  ]);
  return {
    scraping: { active: scrapingActive, waiting: scrapingWaiting },
    normalization: {
      active: normalizationActive,
      waiting: normalizationWaiting,
    },
    enrichment: { active: enrichmentActive, waiting: enrichmentWaiting },
  };
}
```

Add routes in `PipelineController`:

```typescript
@Post('normalize/run')
async runNormalize(@Body() dto: ScrapeApproveDto) {
  return this.pipelineService.queueNormalizationForRecords(dto.ids);
}

@Get('normalize/records')
async getNormalizeRecords() {
  return this.pipelineService.getNormalizationRecords();
}

@Post('normalize/approve')
async approveNormalize(@Body() dto: ScrapeApproveDto) {
  return this.pipelineService.approveNormalizedRecords(dto.ids);
}
```

- [ ] **Step 7: Run green**

Run:

```bash
pnpm nx test @gavai/nest --testFile=src/modules/pipeline/normalization.processor.spec.ts
pnpm nx typecheck @gavai/nest
```

Expected: pass.

## Task 6: Change Scraping To Produce Raw Records And Queue Normalization

**Files:**

- Modify: `apps/gavai/nest/src/modules/pipeline/scraping.processor.ts`
- Modify: `apps/gavai/nest/src/modules/pipeline/services/brightdata.service.ts`
- Modify: `apps/gavai/nest/src/modules/pipeline/pipeline.repository.ts`

- [ ] **Step 1: Stop global full-HTML city selection from deciding final city**

Modify `BrightDataService.parseListingHtml` so it returns raw text and does not select the first global city as final truth. Replace the `phCities` loop result with this safer behavior:

```typescript
const bodyText = strip(html).slice(0, 12000);
const locationCandidate = extractLocationCandidate(title, bodyText);

return {
  title,
  description: bodyText.slice(0, 2000),
  asking_price_php: askingPricePhp,
  lot_area_sqm: lotAreaSqm,
  floor_area_sqm: floorAreaSqm,
  bedrooms,
  bathrooms,
  property_type: 'unknown',
  address_raw: locationCandidate,
  barangay,
  city: null,
  developer: null,
  listing_date: new Date().toISOString().split('T')[0],
  source_url: sourceUrl,
  raw_text_reference: bodyText,
};
```

Add helper inside `parseListingHtml`:

```typescript
const extractLocationCandidate = (
  titleValue: string,
  bodyValue: string,
): string | null => {
  const prioritized = `${titleValue}\n${bodyValue.slice(0, 3000)}`;
  const match = prioritized.match(
    /\b(?:Iloilo City|Iloilo|Cebu City|Mandaue|Lapu[-\s]Lapu|Manila|Quezon City|Makati|Taguig)\b/i,
  );
  return match ? match[0] : null;
};
```

This intentionally avoids converting candidate text to a final city. Normalization owns the final decision.

- [ ] **Step 2: Store raw fields as normalization pending**

Modify `ScrapingProcessor.handleScrape` to write:

```typescript
await this.pipelineRepository.createPendingRecord({
  status: 'normalization_pending',
  sourceUrl: job.data.url,
  sourceName: new URL(job.data.url).hostname.replace(/^www\./, ''),
  title: record.title,
  description: String(rawRecord.description ?? ''),
  addressRaw: record.addressRaw,
  city: undefined,
  barangay: record.barangay ?? undefined,
  propertyType: record.propertyType,
  lotAreaSqm: record.lotAreaSqm ?? undefined,
  floorAreaSqm: record.floorAreaSqm ?? undefined,
  bedrooms: record.bedrooms ?? undefined,
  bathrooms: record.bathrooms ?? undefined,
  askingPricePhp: record.askingPricePhp ?? undefined,
  pricePerSqmPhp,
  listingDate,
  developer: record.developer ?? undefined,
  rawTextReference: String(rawRecord.raw_text_reference ?? ''),
  normalizationStatus: 'pending',
  trainingEligible: false,
  flagged: flags.length > 0,
  flagReason: flags.join('; ') || undefined,
});
```

Update `PipelineRepository.createPendingRecord` input type to include the new fields.

- [ ] **Step 3: Queue normalization after scraping each record**

Inject `normalization` queue into `ScrapingProcessor`:

```typescript
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
```

Constructor:

```typescript
@InjectQueue('normalization') private readonly normalizationQueue: Queue,
```

After `createPendingRecord`, capture the created record and queue it. Use the same full data object from Step 2 and assign the return value:

```typescript
const created = await this.pipelineRepository.createPendingRecord({
  status: 'normalization_pending',
  sourceUrl: job.data.url,
  sourceName: new URL(job.data.url).hostname.replace(/^www\./, ''),
  title: record.title,
  description: String(rawRecord.description ?? ''),
  addressRaw: record.addressRaw,
  city: undefined,
  barangay: record.barangay ?? undefined,
  propertyType: record.propertyType,
  lotAreaSqm: record.lotAreaSqm ?? undefined,
  floorAreaSqm: record.floorAreaSqm ?? undefined,
  bedrooms: record.bedrooms ?? undefined,
  bathrooms: record.bathrooms ?? undefined,
  askingPricePhp: record.askingPricePhp ?? undefined,
  pricePerSqmPhp,
  listingDate,
  developer: record.developer ?? undefined,
  rawTextReference: String(rawRecord.raw_text_reference ?? ''),
  normalizationStatus: 'pending',
  trainingEligible: false,
  flagged: flags.length > 0,
  flagReason: flags.join('; ') || undefined,
});
await this.normalizationQueue.add('normalize-record', { recordId: created.id });
```

- [ ] **Step 4: Update status semantics**

Admin scrape review should now show raw scraped records only if needed. The main admin approval should move to normalized records. Keep `pending_review` only for backward compatibility, but new scrape records should use:

```text
normalization_pending -> normalization_review -> approved -> enriched property
normalization_pending -> normalization_failed
normalization_review -> rejected
```

- [ ] **Step 5: Validate**

Run:

```bash
pnpm nx test @gavai/nest --testFile=src/modules/pipeline/normalization.processor.spec.ts
pnpm nx typecheck @gavai/nest
```

Expected: pass.

## Task 7: Ensure Enrichment And Training Only Use Normalized Records

**Files:**

- Modify: `apps/gavai/nest/src/modules/pipeline/enrichment.processor.ts`
- Modify: `apps/gavai/nest/src/modules/pipeline/pipeline.repository.ts`
- Modify: `apps/gavai/nest/src/modules/valuation/valuation.repository.ts`

- [ ] **Step 1: Gate enrichment**

In `EnrichmentProcessor.handleEnrich`, replace the current approval guard:

```typescript
if (!record || record.status !== 'approved') {
  return { error: 'Record not found or not approved' };
}
```

with:

```typescript
if (
  !record ||
  record.status !== 'approved' ||
  record.normalizationStatus !== 'normalized' ||
  !record.trainingEligible
) {
  return { error: 'Record not normalized, training-eligible, and approved' };
}
```

- [ ] **Step 2: Preserve normalized fields on Property**

When calling `createProperty`, include:

```typescript
sourceRecordId: record.id,
province: record.province ?? undefined,
region: record.region ?? undefined,
normalizationConfidenceScore: record.confidenceScore ?? undefined,
normalizationIssues: (record.normalizationIssues as unknown[]) ?? undefined,
```

Update `PipelineRepository.createProperty` input type with those fields.

- [ ] **Step 3: Gate training records**

Modify `ValuationRepository.getTrainingRecords`:

```typescript
async getTrainingRecords() {
  return this.prisma.property.findMany({
    where: {
      approved: true,
      listingType: 'standard',
      sourceRecord: {
        normalizationStatus: 'normalized',
        trainingEligible: true,
      },
      OR: [{ lotAreaSqm: { not: null } }, { floorAreaSqm: { not: null } }],
    },
    select: {
      id: true,
      propertyType: true,
      lotAreaSqm: true,
      floorAreaSqm: true,
      bedrooms: true,
      bathrooms: true,
      buildingAgeYears: true,
      askingPricePhp: true,
      pricePerSqmPhp: true,
      barangay: true,
      city: true,
      province: true,
      region: true,
      developer: true,
      phivolcsRisk: true,
      floodRisk: true,
      zonalValuePhp: true,
      crepPhp: true,
      proximityScores: true,
      normalizationConfidenceScore: true,
      createdAt: true,
    },
  });
}
```

- [ ] **Step 4: Validate**

Run:

```bash
pnpm nx typecheck @gavai/nest
```

Expected: pass.

## Task 8: Move AVM Training To A Queue Job

**Files:**

- Create: `apps/gavai/nest/src/modules/valuation/training.processor.ts`
- Create: `apps/gavai/nest/src/modules/valuation/training.processor.spec.ts`
- Create: `apps/gavai/nest/src/modules/valuation/valuation.module.spec.ts`
- Modify: `apps/gavai/nest/src/modules/valuation/valuation.module.ts`
- Modify: `apps/gavai/nest/src/modules/valuation/valuation.service.ts`
- Modify: `apps/gavai/nest/src/modules/valuation/valuation.repository.ts`

- [ ] **Step 1: Write training queue test**

Create `apps/gavai/nest/src/modules/valuation/training.processor.spec.ts`:

```typescript
import { TrainingProcessor } from './training.processor';

describe('TrainingProcessor', () => {
  it('does not call sidecar when no normalized records are available', async () => {
    const repository = {
      getTrainingRecords: jest.fn().mockResolvedValue([]),
      createModelVersion: jest.fn(),
      updateModelVersion: jest.fn(),
    };
    const config = {
      getOrThrow: jest.fn().mockReturnValue('http://localhost:8000'),
    };

    const processor = new TrainingProcessor(
      repository as never,
      config as never,
    );

    await expect(
      processor.handleTrain({ id: 'job_1', data: {} } as never),
    ).resolves.toEqual({ status: 'skipped', reason: 'insufficient_records' });
  });

  it('marks model version failed with errorLog when sidecar retrain fails', async () => {
    const repository = {
      getTrainingRecords: jest
        .fn()
        .mockResolvedValue(
          Array.from({ length: 20 }, (_, i) => ({ id: `p_${i}` })),
        ),
      createModelVersion: jest.fn().mockResolvedValue({ id: 'model_1' }),
      updateModelVersion: jest.fn(),
    };
    const config = {
      getOrThrow: jest.fn().mockReturnValue('http://localhost:8000'),
    };
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: jest.fn().mockResolvedValue('sidecar down'),
    }) as never;

    const processor = new TrainingProcessor(
      repository as never,
      config as never,
    );

    await expect(
      processor.handleTrain({ id: 'job_1', data: {} } as never),
    ).rejects.toThrow('Sidecar retrain failed with 502');
    expect(repository.updateModelVersion).toHaveBeenCalledWith('model_1', {
      status: 'failed',
      errorLog: 'Sidecar retrain failed with 502: sidecar down',
    });

    global.fetch = originalFetch;
  });
});
```

- [ ] **Step 2: Run red**

Run:

```bash
pnpm nx test @gavai/nest --testFile=src/modules/valuation/training.processor.spec.ts
```

Expected: fail because processor does not exist.

- [ ] **Step 3: Implement processor**

Create `apps/gavai/nest/src/modules/valuation/training.processor.ts`:

```typescript
import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ValuationRepository } from './valuation.repository';

@Processor('training')
@Injectable()
export class TrainingProcessor {
  private readonly logger = new Logger(TrainingProcessor.name);
  private readonly sidecarUrl: string;

  constructor(
    private readonly valuationRepository: ValuationRepository,
    configService: ConfigService,
  ) {
    this.sidecarUrl = configService.getOrThrow<string>('ML_SIDECAR_URL');
  }

  @Process('train-avm')
  async handleTrain(
    job: Job,
  ): Promise<
    | { status: 'skipped'; reason: 'insufficient_records' }
    | { status: 'ready'; version: string; trainingRecords: number }
  > {
    const records = await this.valuationRepository.getTrainingRecords();
    if (records.length < 20) {
      this.logger.warn(
        `Skipping AVM training: only ${records.length} normalized records`,
      );
      return { status: 'skipped', reason: 'insufficient_records' };
    }

    const modelVersion = await this.valuationRepository.createModelVersion({
      version: `training-${job.id}`,
      modelPath: '',
      status: 'training',
      trainingRecords: records.length,
      jobId: String(job.id),
    });

    const response = await fetch(`${this.sidecarUrl}/api/v1/admin/retrain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
      signal: AbortSignal.timeout(300000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const errorLog = `Sidecar retrain failed with ${response.status}: ${body.slice(0, 1000)}`;
      await this.valuationRepository.updateModelVersion(modelVersion.id, {
        status: 'failed',
        errorLog,
      });
      throw new Error(`Sidecar retrain failed with ${response.status}`);
    }

    const result = (await response.json()) as {
      version: string;
      mape: number;
      trainingRecords: number;
    };

    await this.valuationRepository.updateModelVersion(modelVersion.id, {
      version: result.version,
      modelPath: `models/avm-${result.version}.pkl`,
      status: 'ready',
      mape: result.mape,
      trainingRecords: result.trainingRecords,
    });

    return {
      status: 'ready',
      version: result.version,
      trainingRecords: result.trainingRecords,
    };
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Training job ${job.id} failed: ${error.message}`);
  }
}
```

The status contract is deliberately expanded to `training | ready | deployed | archived | failed` in Task 3. Do not replace failed model versions with `archived`; failed training attempts must remain visible in model history.

Update `ValuationRepository.updateModelVersion` input type in `apps/gavai/nest/src/modules/valuation/valuation.repository.ts`:

```typescript
async updateModelVersion(
  id: string,
  data: {
    status?: string;
    mape?: number;
    trainingRecords?: number;
    modelPath?: string;
    deployedAt?: Date;
    jobId?: string;
    errorLog?: string;
  },
) {
  return this.prisma.modelVersion.update({ where: { id }, data });
}
```

- [ ] **Step 4: Register queue**

Modify `ValuationModule`:

```typescript
import { BullModule } from '@nestjs/bull';
import { QueueModule } from '../queue/queue.module';
import { TrainingProcessor } from './training.processor';
```

Add queue registration:

```typescript
imports: [QueueModule, BullModule.registerQueue({ name: 'training' })],
```

Add `TrainingProcessor` to providers.

- [ ] **Step 5: Add a module wiring test for training queue injection**

Create `apps/gavai/nest/src/modules/valuation/valuation.module.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { ValuationModule } from './valuation.module';

describe('ValuationModule queue wiring', () => {
  it('provides the training queue token', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              REDIS_URL: 'redis://localhost:6379',
              ML_SIDECAR_URL: 'http://localhost:8000',
            }),
          ],
        }),
        ValuationModule,
      ],
    }).compile();

    expect(
      moduleRef.get(getQueueToken('training'), { strict: false }),
    ).toBeDefined();
  });
});
```

Run:

```bash
pnpm nx test @gavai/nest --testFile=src/modules/valuation/valuation.module.spec.ts
```

Expected: pass only after `QueueModule` and `BullModule.registerQueue({ name: 'training' })` are wired correctly.

- [ ] **Step 6: Make retrain endpoint enqueue, not block**

Modify `ValuationService` constructor:

```typescript
@InjectQueue('training') private readonly trainingQueue: Queue,
```

Change `triggerRetrain` to:

```typescript
async triggerRetrain(): Promise<{ queued: true; jobId: string | number | undefined }> {
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
```

Update frontend type `RetrainResponse` to match this queued response or add a separate `TrainQueuedResponse`:

```typescript
export interface TrainQueuedResponse {
  queued: true;
  jobId: string | number | undefined;
}
```

Update `useRetrain` to return `TrainQueuedResponse` and invalidate `['admin', 'model', 'versions']` so polling/history can show the queued and later completed model version.

- [ ] **Step 7: Validate**

Run:

```bash
pnpm nx test @gavai/nest --testFile=src/modules/valuation/training.processor.spec.ts
pnpm nx test @gavai/nest --testFile=src/modules/valuation/valuation.module.spec.ts
pnpm nx typecheck @gavai/nest
```

Expected: pass.

## Task 9: Add Admin Normalize Page And Update Admin Flow

**Files:**

- Create: `apps/gavai/web/src/app/admin/normalize/page.tsx`
- Create: `apps/gavai/web/specs/admin-normalize.spec.tsx`
- Modify: `apps/gavai/web/src/app/admin/layout.tsx`
- Modify: `apps/gavai/web/src/app/admin/scrape/page.tsx`
- Modify: `apps/gavai/web/src/app/admin/model/page.tsx`
- Modify: `apps/gavai/web/src/types/api.ts`

- [ ] **Step 1: Add frontend types**

Modify `apps/gavai/web/src/types/api.ts`:

```typescript
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
```

- [ ] **Step 2: Create normalize page**

Create `apps/gavai/web/src/app/admin/normalize/page.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import type { NormalizedRecord } from '@/types/api';

export default function AdminNormalizePage(): React.ReactNode {
  const [records, setRecords] = useState<NormalizedRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState(false);

  const loadRecords = useCallback(async (): Promise<void> => {
    const response = await api.get<{ data: NormalizedRecord[] }>(
      '/admin/normalize/records',
    );
    setRecords(response.data.data);
  }, []);

  useEffect(() => {
    loadRecords().catch(() => toast.error('Failed to load normalized records'));
  }, [loadRecords]);

  const approve = async (): Promise<void> => {
    setApproving(true);
    try {
      await api.post('/admin/normalize/approve', { ids: Array.from(selected) });
      toast.success(`Approved ${selected.size} normalized records`);
      setSelected(new Set());
      await loadRecords();
    } catch {
      toast.error('Approval failed');
    } finally {
      setApproving(false);
    }
  };

  const readyCount = records.filter(
    (r) => r.normalizationStatus === 'normalized',
  ).length;
  const failedCount = records.filter(
    (r) => r.normalizationStatus === 'failed',
  ).length;
  const lowConfidenceCount = records.filter(
    (r) => r.normalizationStatus === 'low_confidence',
  ).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Normalize</CardTitle>
          <Button variant="outline" size="sm" onClick={loadRecords}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-3">
            <Badge variant="secondary">{readyCount} ready</Badge>
            <Badge variant="outline">{lowConfidenceCount} low confidence</Badge>
            <Badge variant="destructive">{failedCount} failed</Badge>
          </div>
          {selected.size > 0 && (
            <Button
              onClick={approve}
              disabled={approving}
              size="sm"
              className="mb-4"
            >
              {approving ? 'Approving...' : `Approve (${selected.size})`}
            </Button>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Title</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => {
                const selectable =
                  record.normalizationStatus === 'normalized' &&
                  record.trainingEligible;
                return (
                  <TableRow key={record.id}>
                    <TableCell>
                      <Checkbox
                        disabled={!selectable}
                        checked={selected.has(record.id)}
                        onCheckedChange={() => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(record.id)) next.delete(record.id);
                            else next.add(record.id);
                            return next;
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {record.title ?? '-'}
                    </TableCell>
                    <TableCell>
                      {[record.city, record.province]
                        .filter(Boolean)
                        .join(', ') || '-'}
                    </TableCell>
                    <TableCell>
                      {record.askingPricePhp
                        ? `PHP ${record.askingPricePhp.toLocaleString()}`
                        : '-'}
                    </TableCell>
                    <TableCell>{record.confidenceScore ?? '-'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          record.normalizationStatus === 'normalized'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {record.normalizationStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {(record.normalizationIssues ?? []).join('; ') ||
                        record.flagReason ||
                        '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Add nav item**

Modify `apps/gavai/web/src/app/admin/layout.tsx`:

```typescript
import {
  Search,
  Download,
  ArrowLeft,
  BarChart3,
  Brain,
  ListChecks,
} from 'lucide-react';
```

Add nav item between Scrape and Model:

```typescript
{
  title: 'Normalize',
  url: '/admin/normalize',
  icon: ListChecks,
},
```

- [ ] **Step 4: Update model page copy and gate**

In `apps/gavai/web/src/app/admin/model/page.tsx`, change labels from `Approved training records` to `Normalized training records`. Disable retrain button if records length is less than 20 or normalized readiness metadata says not ready.

Update `ModelVersion` in `apps/gavai/web/src/types/api.ts`:

```typescript
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
```

Also update model status rendering:

```typescript
function statusVariant(
  status: string,
): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'deployed':
      return 'default';
    case 'ready':
      return 'secondary';
    case 'training':
      return 'outline';
    case 'archived':
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
}
```

In the version history table, render `v.errorLog` under failed rows:

```tsx
{
  v.status === 'failed' && v.errorLog && (
    <p className="mt-1 max-w-md truncate text-xs text-destructive">
      {v.errorLog}
    </p>
  );
}
```

- [ ] **Step 5: Validate**

Run:

```bash
pnpm nx typecheck @gavai/web
pnpm nx test @gavai/web
```

Expected: pass.

## Task 10: Expand Report API Data To Include Normalized Property Evidence

This task does not implement real PDF rendering. `pdfUrl` may remain `null`; the required change is that the report API returns the data a later PDF renderer will need: valuation, normalized comparables, and clear warnings when data is sparse. Add PDF generation as a future plan after this data-quality pipeline is working.

**Files:**

- Create/modify: `apps/gavai/nest/src/modules/report/report.service.spec.ts`
- Modify: `apps/gavai/nest/src/modules/report/report.repository.ts`
- Modify: `apps/gavai/nest/src/modules/report/report.service.ts`
- Modify: `apps/gavai/web/src/types/api.ts`

- [ ] **Step 1: Write service test**

Create `apps/gavai/nest/src/modules/report/report.service.spec.ts`:

```typescript
import { ReportService } from './report.service';

describe('ReportService', () => {
  it('includes insufficient normalized data warning when comparables are sparse', async () => {
    const reportRepository = {
      findByValuationId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'report_1',
        valuationId: 'val_1',
        pdfUrl: null,
        verificationHash: 'hash',
        createdAt: new Date('2026-05-28T00:00:00.000Z'),
      }),
      findNormalizedComparablesForValuation: jest.fn().mockResolvedValue([]),
    };
    const valuationRepository = {
      findValuationById: jest.fn().mockResolvedValue({
        id: 'val_1',
        inputLat: 10.72,
        inputLng: 122.56,
        propertyType: 'residential_lot',
      }),
    };

    const service = new ReportService(
      reportRepository as never,
      valuationRepository as never,
    );
    const result = await service.generateReport('val_1');

    expect(result.normalizedListings).toEqual([]);
    expect(result.warnings).toContain(
      'Not enough normalized comparable listings in this area',
    );
  });
});
```

- [ ] **Step 2: Run red**

Run:

```bash
pnpm nx test @gavai/nest --testFile=src/modules/report/report.service.spec.ts
```

Expected: fail because current result does not include `normalizedListings` or `warnings`.

- [ ] **Step 3: Add repository query**

Modify `ReportRepository`:

```typescript
async findNormalizedComparablesForValuation(input: {
  lat: number;
  lng: number;
  propertyType: string;
  radiusM: number;
}) {
  return this.prisma.$queryRaw<
    {
      id: string;
      title: string | null;
      city: string | null;
      province: string | null;
      askingPricePhp: number;
      pricePerSqmPhp: number | null;
      lotAreaSqm: number | null;
      floorAreaSqm: number | null;
      normalizationConfidenceScore: number | null;
      distanceM: number;
    }[]
  >`
    SELECT
      p.id,
      p."rawTitle" AS title,
      p.city,
      p.province,
      p."askingPricePhp",
      p."pricePerSqmPhp",
      p."lotAreaSqm",
      p."floorAreaSqm",
      p."normalizationConfidenceScore",
      ST_Distance(
        ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography
      ) AS "distanceM"
    FROM "Property" p
    JOIN "PendingTrainingRecord" r ON r.id = p."sourceRecordId"
    WHERE ST_DWithin(
      ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
      ${input.radiusM}
    )
    AND p."approved" = true
    AND p."listingType" = 'standard'
    AND p."propertyType" = ${input.propertyType}
    AND r."normalizationStatus" = 'normalized'
    AND r."trainingEligible" = true
    ORDER BY "distanceM" ASC
    LIMIT 10
  `;
}
```

- [ ] **Step 4: Extend report service result**

Modify `ReportResult`:

```typescript
export interface ReportResult {
  id: string;
  valuationId: string;
  pdfUrl: string | null;
  verificationHash: string;
  createdAt: Date;
  normalizedListings: unknown[];
  warnings: string[];
}
```

In `generateReport`, fetch comparables:

```typescript
const normalizedListings =
  valuation.inputLat != null && valuation.inputLng != null
    ? await this.reportRepository.findNormalizedComparablesForValuation({
        lat: valuation.inputLat,
        lng: valuation.inputLng,
        propertyType: valuation.propertyType,
        radiusM: 3000,
      })
    : [];

const warnings =
  normalizedListings.length < 3
    ? ['Not enough normalized comparable listings in this area']
    : [];

const report = await this.reportRepository.create(
  valuationId,
  pdfUrl,
  verificationHash,
);
return { ...report, normalizedListings, warnings };
```

For existing reports returned early, also fetch and attach normalized listings before returning.

- [ ] **Step 5: Validate**

Run:

```bash
pnpm nx test @gavai/nest --testFile=src/modules/report/report.service.spec.ts
pnpm nx typecheck @gavai/nest
```

Expected: pass.

## Task 11: Add End-To-End Pipeline Unit Coverage

**Files:**

- Create: `apps/gavai/nest/src/modules/pipeline/pipeline.service.spec.ts`

- [ ] **Step 1: Write pipeline queue test**

Create `apps/gavai/nest/src/modules/pipeline/pipeline.service.spec.ts`:

```typescript
import { PipelineService } from './pipeline.service';

describe('PipelineService normalization queue flow', () => {
  it('queues normalization before enrichment', async () => {
    const repository = {
      computeUrlHash: jest.fn((url: string) => `hash:${url}`),
      findTargetByUrlHash: jest.fn().mockResolvedValue(null),
      createScrapingTargets: jest.fn().mockResolvedValue({ count: 1 }),
      approveTargets: jest.fn(),
      findQueuedTargets: jest.fn().mockResolvedValue([]),
      approveRecords: jest.fn(),
      findRecordById: jest.fn(),
      rejectRecords: jest.fn(),
      findPendingReviewTargets: jest.fn(),
      findPendingReviewRecords: jest.fn(),
      findScrapingJobs: jest.fn(),
    };
    const brightdata = {
      discover: jest
        .fn()
        .mockResolvedValue({ urls: ['https://example.com/iloilo'] }),
    };
    const scrapingQueue = {
      add: jest.fn(),
      getActiveCount: jest.fn(),
      getWaitingCount: jest.fn(),
    };
    const normalizationQueue = {
      add: jest.fn(),
      getActiveCount: jest.fn(),
      getWaitingCount: jest.fn(),
    };
    const enrichmentQueue = {
      add: jest.fn(),
      getActiveCount: jest.fn(),
      getWaitingCount: jest.fn(),
    };

    const service = new PipelineService(
      repository as never,
      brightdata as never,
      scrapingQueue as never,
      normalizationQueue as never,
      enrichmentQueue as never,
    );

    await service.queueNormalizationForRecords(['rec_1']);

    expect(normalizationQueue.add).toHaveBeenCalledWith('normalize-record', {
      recordId: 'rec_1',
    });
    expect(enrichmentQueue.add).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run and fix constructor test drift**

Run:

```bash
pnpm nx test @gavai/nest --testFile=src/modules/pipeline/pipeline.service.spec.ts
```

Expected: pass after the constructor and method signatures match Task 5.

## Task 12: Final Validation And Manual Checks

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm nx test pipeline
pnpm nx test @gavai/nest
pnpm nx test @gavai/web
```

Expected: all pass.

- [ ] **Step 2: Run typechecks**

Run:

```bash
pnpm nx typecheck pipeline
pnpm nx typecheck @gavai/platform
pnpm nx typecheck @gavai/nest
pnpm nx typecheck @gavai/web
```

Expected: all pass.

- [ ] **Step 3: Run lint**

Run:

```bash
pnpm nx lint pipeline
pnpm nx lint @gavai/platform
pnpm nx lint @gavai/nest
pnpm nx lint @gavai/web
```

Expected: all pass.

- [ ] **Step 4: Manual verification**

With local Postgres, Redis, Nest, web, and sidecar running:

```bash
pnpm run infra:up
pnpm nx serve @gavai/nest
pnpm nx serve @gavai/sidecar
pnpm nx dev @gavai/web
```

Manual checks:

1. In admin Discover, search `Iloilo City residential lot`.
2. Approve one discovered target.
3. Run Scrape.
4. Confirm normalization queue runs.
5. Open Admin -> Normalize.
6. Confirm Iloilo records show `Iloilo City, Iloilo`, not Manila.
7. Confirm records without location show missing or failed, not Manila.
8. Approve only normalized records.
9. Confirm approved normalized records become enriched `Property` rows.
10. Confirm Admin -> Model reports only normalized training records.
11. Trigger retrain and confirm a training job is queued instead of blocking the request.
12. On map valuation/report, confirm report response includes normalized listings or a warning.

## Acceptance Criteria Mapping

- Admin flow includes normalization: Tasks 5 and 9.
- Raw scraped data is not directly used for training: Tasks 6, 7, and 8.
- Iloilo is not interpreted as Manila: Tasks 1, 2, 5, and 6.
- AI does not guess missing fields: Tasks 2 and 4.
- Redis/Bull jobs are used for long-running work: Tasks 5 and 8.
- Failed/low-confidence records are visible/logged: Tasks 5 and 9.
- Maps/report can use normalized property data: Task 10.
- AI/ML API output is runtime-validated and malformed output is rejected: Task 4.
- Training queue wiring is verified before runtime: Tasks 0 and 8.
- Failed training attempts are visible in model history: Tasks 3, 8, and 9.
- PDF rendering is explicitly deferred and not silently implied: Task 10.
- Existing architecture preserved: all tasks keep current modules and patterns.
- Testing coverage added: Tasks 0, 1, 2, 4, 5, 8, 10, and 11.

## Grill-Me Risk Review

Question: Should normalized data be a new table or extend `PendingTrainingRecord`?

Recommended answer: Extend `PendingTrainingRecord` and link `Property.sourceRecordId` back to it. This is the smallest safe schema change because the current code already uses `PendingTrainingRecord` as the admin review staging table.

Question: Should AI output decide final location?

Recommended answer: No. AI output is only an extraction hint. The deterministic normalizer must preserve explicit source locations, reject unsupported Manila defaults, and mark uncertainty.

Question: Should training run synchronously?

Recommended answer: No. Retraining can take minutes and already depends on Redis/Bull-style infrastructure. Queue `train-avm` and let the admin page poll model versions/job status.

Question: Should low-confidence records be trainable?

Recommended answer: No by default. Keep `low_confidence` visible for admin review, but only `normalizationStatus = normalized` and `trainingEligible = true` should flow into `Property` and AVM training.

Question: Should reports fabricate valuation narrative when data is sparse?

Recommended answer: No. Return normalized comparable data when available and a clear warning when fewer than three normalized comparables are found.

Question: Should this plan implement actual PDF report rendering?

Recommended answer: No. Defer real PDF rendering. This plan must make report data correct and explicitly state that PDF rendering is a later implementation task.

Question: Should old `Property` rows without `sourceRecordId` remain trainable?

Recommended answer: No. Exclude legacy unnormalized rows by default. Add a separate backfill/renormalization plan only if old data must be preserved.

Question: Should failed AVM training jobs create visible model history?

Recommended answer: Yes. Add `ModelVersion.status = failed` and `ModelVersion.errorLog` so admins can see failed attempts without digging through Redis/Bull logs.

Question: Should AI/ML extraction output rely on TypeScript types only?

Recommended answer: No. Validate AI output with Zod at runtime and add tests that reject malformed confidence values and unexpected fields.

Question: Should feature modules each own Bull root config?

Recommended answer: No. Centralize Bull root configuration in `QueueModule`, then let feature modules register their specific queues. Add module compile tests so broken queue injection is caught early.

Question: Should low-confidence normalized records be admin-overridable into training?

Recommended answer: No override in this plan. Low-confidence records remain visible for review, but only fully normalized and training-eligible records can become `Property` rows for AVM training.

Question: What happens if `AIMLAPI_KEY` is missing or AI/ML API is down?

Recommended answer: Fall back to deterministic extraction from scraped fields, mark confidence lower, log the reason, and still require deterministic validation before anything becomes trainable.

## Remaining Unknowns To Resolve During Implementation

- The exact AI/ML API model can be changed with `AIMLAPI_MODEL`. The plan uses `gpt-4o-mini` as a configurable default; the owner can switch the model through env without changing the pipeline.
- Existing `@nestjs/bull` uses Bull v4 while `bullmq` is also installed. This plan deliberately keeps Bull v4 because the current module already uses `@nestjs/bull`, `@Processor`, and `Queue` from `bull`.
- Report PDF generation is explicitly deferred. After this plan, add a separate PDF-rendering plan that consumes the enriched report API payload.
- `Property` rows created before this migration will not have `sourceRecordId` and will be excluded from AVM training by default. If preserving old data matters, add a separate backfill/renormalization plan.
