# 10 — Spider Chart (Multi-Factor Risk Assessment)

## Overview

Add a radar/spider chart to the Area Intelligence feature showing 5 risk/quality axes for any pinned property. This gives buyers an intuitive visual breakdown of location quality beyond the AVM price estimate.

**5 axes:**

1. **Flood Risk** — Project NOAH PMTiles from HuggingFace
2. **Traffic** — Google Distance Matrix historical traffic data
3. **Development Yield** — Gemini Flash sentiment on area news articles
4. **Market Premium** — `AVM price per sqm ÷ BIR zonal per sqm` (replaces raw zonal value)
5. **Fault** — Placeholder (0.5 neutral) until PHIVOLCS data loaded

Each axis normalizes to `[0, 1]`. Higher = better for property value.

---

## Why Market Premium Instead of Raw Zonal Value

Raw zonal value is a weak spider axis — it's a BIR tax floor, lags the market by years, and is identical for every property in the same barangay. It tells a buyer nothing they couldn't infer from knowing the city.

**Market Premium Index** is a derived ratio:

```
market_premium = AVM_estimated_price_per_sqm / zonal_value_per_sqm
```

| Ratio   | Signal                                                            |
| ------- | ----------------------------------------------------------------- |
| 1.0–2.0 | Priced close to zonal floor — potentially undervalued or stagnant |
| 2.0–4.0 | Healthy market premium — normal Metro Manila                      |
| 4.0–7.0 | Hot market — BGC/Makati tier repricing                            |
| 7.0+    | Extreme premium — likely luxury or speculation                    |

Normalized to 0–1: `score = clamp(ratio / 7.0, 0, 1)` → inverse for "too hot" (scores above 4.0 get penalized slightly).

**Caveat:** This axis needs the AVM valuation to have already run for the pin. The spider chart renders as a result layer, not an input layer.

---

## Architecture

```
GET /area/risk-assessment?lat=&lng=
              ↓
      AreaRiskController
              ↓
      AreaRiskService
     /    |    |    \
Flood   Traffic  Yield  MarketPremium  Fault
Score   Score    Score  Score          Score
  ↓       ↓       ↓       ↓              ↓
PMTiles  Google  Gemini  AVM + BIR     (placeholder)
(HF CDN) Routes  Flash   ZonalValue
         API
```

All scores cached in `AreaRiskScores` table with 500m grid key + 24h TTL (same pattern as `AreaIntelligence`).

---

## Prerequisites

| Item                                   | Status                   | Notes                                                                                                                     |
| -------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_MAPS_KEY` (server)             | Already in `.env`        | Also needs **Elevation API enabled** in GCP console                                                                       |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` (client) | Already in `.env`        | Already used by MapProvider                                                                                               |
| `GEMINI_API_KEY`                       | Already in `.env`        | Already used by area intelligence                                                                                         |
| `BRIGHTDATA_API_KEY`                   | Already in `.env`        | Already used by area intelligence                                                                                         |
| HuggingFace PMTiles                    | Free, no account         | URL: `https://huggingface.co/datasets/bettergovph/project-noah-hazard-maps/resolve/main/PMTiles/noah_hazard_maps.pmtiles` |
| New npm packages (web)                 | Need install             | `recharts`                                                                                                                |
| New npm packages (nest)                | Need install             | `pmtiles`, `@mapbox/vector-tile`, `@turf/turf`                                                                            |
| BIR zonal CSVs for Metro Manila        | Have Tondo + Mandaluyong | CSV parser handles any RDO sheet                                                                                          |

---

## Database Changes

### New Model: `AreaRiskScores`

```prisma
model AreaRiskScores {
  id        String   @id @default(cuid())
  latKey    Float
  lngKey    Float

  floodScore        Float?
  floodLevel        String?   // "none" | "low" | "medium" | "high"
  trafficScore      Float?
  trafficSpeedRatio Float?
  yieldScore        Float?
  yieldArticleCount Int?
  marketPremium     Float?
  faultScore        Float?    @default(0.5)

  metadata   Json
  fetchedAt  DateTime @default(now())
  expiresAt  DateTime

  @@unique([latKey, lngKey])
}
```

### Migration

```bash
pnpm nx run @gavai/platform:prisma-migrate -- --name add-area-risk-scores
```

---

## Implementation Tasks (11 sub-tasks, 4 parallel streams)

### Stream A: Map Enhancements (Frontend — Independent)

#### Task A1: Switch map center to Metro Manila

- **Files:** `apps/gavai/web/src/providers/MapProvider.tsx`, `apps/gavai/web/src/app/map/page.tsx`
- Change `defaultCenter` from Cebu `{ lat: 10.3157, lng: 123.8854 }` to Metro Manila `{ lat: 14.5995, lng: 120.9842 }`
- Update `bboxQuery` from `123.7,10.1,124.0,10.5` to `120.9,14.3,121.2,14.75`
- Update `listingsBounds` to match Metro Manila bounds
- Update `defaultZoom` from 13 to 12 (Metro Manila is larger)

#### Task A2: Add satellite view toggle

- **Files:** `apps/gavai/web/src/components/MapContainer.tsx`, `apps/gavai/web/src/app/map/page.tsx`
- Add `mapTypeId` state to toggle between `'roadmap'` and `'satellite'`
- Add a `MapTypeButton` component (toggle in top-left next to GAVAI logo)
- When satellite mode: set `tilt: 45` on Google Map options for 3D perspective
- Import `Satellite` icon from lucide-react

#### Task A3: Show elevation at pin location

- **Files:** `apps/gavai/web/src/components/ElevationLabel.tsx` (new), `apps/gavai/web/src/app/map/page.tsx`
- On pin drop, call Google Maps Elevation API:
  ```
  GET https://maps.googleapis.com/maps/api/elevation/json?locations=LAT,LNG&key=KEY
  ```
- Call via Axios using `NEXT_PUBLIC_GOOGLE_MAPS_KEY`
- Display elevation as a small label near the pin marker (e.g., "12m elevation")
- Show elevation in ValuationPanel header area

---

### Stream B: Flood Risk Pipeline (Backend — Independent)

#### Task B1: Install npm packages for PMTiles

```bash
cd apps/gavai/nest && pnpm add pmtiles @mapbox/vector-tile @turf/turf
```

#### Task B2: Create FloodRiskService

- **File:** `apps/gavai/nest/src/modules/area/flood-risk.service.ts` (new)
- Open PMTiles from HuggingFace CDN URL (supports HTTP range requests natively)
- For a given `(lat, lng)`:
  1. Compute tile `Z=12 / X / Y` using standard web mercator tile math
  2. Fetch MVT tile bytes via `PMTiles.getZxy()`
  3. Decode MVT with `@mapbox/vector-tile`
  4. For each `flood_100yr` layer feature, check `@turf/boolean-point-in-polygon`
  5. Return `{ level: "none" | "low" | "medium" | "high", var: null | 1 | 2 | 3 }`
- Normalize to score: `3 → 0.0`, `2 → 0.35`, `1 → 0.7`, `null → 1.0`
- Also check `landslide` layer, `storm_surge_ssa1-4` layers → take worst score
- Cache PMTiles header/metadata in-memory (don't re-fetch per request)
- Tile-to-latlng conversion helper:
  ```typescript
  function lngLatToTile(
    lng: number,
    lat: number,
    zoom: number,
  ): { x: number; y: number } {
    const x = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
    const y = Math.floor(
      ((1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180),
        ) /
          Math.PI) /
        2) *
        Math.pow(2, zoom),
    );
    return { x, y };
  }
  ```

---

### Stream C: Traffic + Yield Pipeline (Backend — Depends on existing services)

#### Task C1: Create TrafficScoreService

- **File:** `apps/gavai/nest/src/modules/area/traffic-score.service.ts` (new)
- Inject existing `GoogleMapsService`
- For a given `(lat, lng)`:
  1. Query Distance Matrix API 3 times with `departureTime`:
     - AM peak: today 8:00 AM
     - PM peak: today 6:00 PM
     - Off-peak: today 2:00 AM
  2. Destination: nearest CBD centroid (pre-computed: Makati CBD, Ortigas, BGC, Manila)
  3. Extract `duration_in_traffic` (peak) and `duration` (off-peak = freeflow)
  4. Compute: `speedRatio = freeflowDuration / avgPeakDuration`
  5. Normalize to score: `clamp(speedRatio, 0, 1)`
- Cache per barangay-centroid key (reverse geocode first at 500m grid)
- TTL: 6 hours

#### Task C2: Create YieldScoreService (extends area intelligence)

- **File:** `apps/gavai/nest/src/modules/area/yield-score.service.ts` (new)
- Reuses the same BrightData + Gemini pipeline as `AreaService.fetchFresh()`
- Extends Gemini prompt to output structured JSON alongside bullet points:
  ```
  After the bullet points, output a JSON array of article classifications:
  [{"sentiment": "positive|neutral|negative", "category": "infrastructure|commercial|residential|risk", "horizon_years": number}]
  ```
- Compute yield index:
  - `positiveRatio = count(positive) / total`
  - `infraRatio = (count(infrastructure) + count(commercial)) / total`
  - `yieldScore = clamp(positiveRatio * 0.6 + infraRatio * 0.4, 0, 1)`
- Cache alongside `AreaIntelligence` (same grid key, same 24h TTL)

---

### Stream D: Market Premium + API + Spider Chart UI (Core integration)

#### Task D1: Create MarketPremiumService

- **File:** `apps/gavai/nest/src/modules/area/market-premium.service.ts` (new)
- Inject `PrismaService` (for ZonalValue lookup)
- For a given `(lat, lng)`:
  1. Call **existing AVM valuation** (`ValuationService.createValuation()`) to get `pricePerSqmPhp`
  2. Call existing `ZonalLookupService.getZonalValue()` to get barangay zonal value
  3. Compute: `marketPremium = pricePerSqmPhp / zonalValuePhp`
  4. Normalize to score:
     - `ratio < 1.0` → `0.3` (below zonal — distressed)
     - `1.0 ≤ ratio < 2.0` → `0.5` (close to zonal — potentially undervalued)
     - `2.0 ≤ ratio < 4.0` → `0.8` (healthy premium)
     - `4.0 ≤ ratio < 7.0` → `0.9` (hot market)
     - `ratio ≥ 7.0` → `0.7` (overheated — slight penalty)
- This MUST run after AVM valuation has completed for the pin

#### Task D2: Create AreaRiskModule (API endpoint)

- **Files:** (all new)
  - `apps/gavai/nest/src/modules/area-risk/area-risk.module.ts`
  - `apps/gavai/nest/src/modules/area-risk/area-risk.controller.ts`
  - `apps/gavai/nest/src/modules/area-risk/area-risk.service.ts`
  - `apps/gavai/nest/src/modules/area-risk/area-risk.repository.ts`
  - `apps/gavai/nest/src/modules/area-risk/dto/risk-assessment.dto.ts`
  - `apps/gavai/nest/src/modules/area-risk/types/risk.types.ts`
- Register in `app.module.ts`

**Controller:**

```typescript
@Controller('area')
@UseGuards(JwtAuthGuard)
export class AreaRiskController {
  constructor(private readonly areaRiskService: AreaRiskService) {}

  @Get('risk-assessment')
  async getRiskAssessment(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
  ): Promise<RiskAssessmentResponseDto> {
    return this.areaRiskService.getRiskAssessment(lat, lng);
  }
}
```

**Service** (orchestrator):

```typescript
@Injectable()
export class AreaRiskService {
  async getRiskAssessment(lat: number, lng: number): Promise<RiskAssessmentResult> {
    const { latKey, lngKey } = roundToGrid(lat, lng);

    // 1. Check cache
    const cached = await this.repo.findCached(latKey, lngKey);
    if (cached && cached.expiresAt > new Date()) return cached;

    // 2. Fetch all scores in parallel
    const [flood, traffic, yield_, marketPremium] = await Promise.allSettled([
      this.floodRiskService.getScore(lat, lng),
      this.trafficScoreService.getScore(lat, lng),
      this.yieldScoreService.getScore(lat, lng),
      this.marketPremiumService.getScore(lat, lng),
    ]);

    // 3. Assemble result (graceful degradation per axis)
    const result = {
      flood: flood.status === 'fulfilled' ? flood.value : { score: null, error: 'failed' },
      traffic: /* same pattern */,
      yield: /* same pattern */,
      marketPremium: /* same pattern */,
      fault: { score: 0.5, status: 'placeholder' },
    };

    // 4. Cache result
    await this.repo.upsert(latKey, lngKey, result, /* 24h TTL */);
    return result;
  }
}
```

**Response shape:**

```json
{
  "data": {
    "scores": {
      "flood": 0.85,
      "traffic": 0.62,
      "yield": 0.71,
      "marketPremium": 0.55,
      "fault": 0.5
    },
    "metadata": {
      "flood": {
        "level": "low",
        "source": "Project NOAH",
        "returnPeriod": "100yr"
      },
      "traffic": { "speedRatio": 0.68, "cachedAt": "2026-05-29T..." },
      "yield": { "articleCount": 12, "positiveRatio": 0.6 },
      "marketPremium": {
        "avmPerSqm": 85000,
        "zonalPerSqm": 42000,
        "ratio": 2.02
      },
      "fault": { "status": "placeholder" }
    }
  }
}
```

#### Task D3: Create SpiderChart UI component

- **File:** `apps/gavai/web/src/components/SpiderChart.tsx` (new)
- Install `recharts`: `pnpm add recharts` in `apps/gavai/web`
- Use `<RadarChart>` with 5 axes
- Color coding per axis based on score:
  - `≥ 0.7` → `#10b981` (green/emerald)
  - `0.4–0.7` → `#f59e0b` (yellow/amber)
  - `< 0.4` → `#ef4444` (red)
- Transparent blue fill polygon for the data area
- Axis labels: Flood, Traffic, Yield, Market, Fault
- Tooltip on hover showing score + metadata per axis
- Responsive: fit within the ValuationPanel width (~360px on mobile)

#### Task D4: Wire SpiderChart + ElevationLabel into ValuationPanel

- **File:** `apps/gavai/web/src/components/ValuationPanel.tsx`
- Add `SpiderChart` component between confidence range and BIR compliance sections
- Add `ElevationLabel` near the estimated value header
- Pass risk scores as new prop: `riskScores?: RiskAssessmentResponse`
- **File:** `apps/gavai/web/src/hooks/useRiskScores.ts` (new)
  - TanStack Query hook: `queryKey: ['riskScores', lat, lng]`
  - Calls `GET /area/risk-assessment?lat=&lng=`
  - Only enabled when `selectedLat !== null && selectedLng !== null` AND valuation is complete
  - Returns `{ data: RiskAssessmentResponse, isLoading }`
- **File:** `apps/gavai/web/src/types/api.ts` — add `RiskAssessmentResponse` type

#### Task D5: Wire useRiskScores into map page

- **File:** `apps/gavai/web/src/app/map/page.tsx`
- Import and use `useRiskScores` hook
- Pass `riskScores` data to `ValuationPanel`
- Wait for valuation to complete before fetching risk scores (dependency chain)

---

### Stream E: BIR Zonal CSV Parser + Metro Manila Seed (Data — Independent)

#### Task E1: Create CSV parser script

- **File:** `scripts/parse-bir-zonal.ts` (new)
- Parse both CSV formats (Tondo 2011 and Mandaluyong 2019 style)
- Handle quirks:
  - `BARANGAY: X,ZONE: X` vs `ZONE/BARANGAY,BARANGAY NAME`
  - `CONDOMINIUMS/TOWNHOUSES:` subsection → `zoneType: 'condominium'`
  - `*` annotations in classification or values → strip
  - Empty/dash values → skip row
  - Continuation pages → append to same barangay
  - Multiple classifications per street → one row per `(street, classification)`
  - `ALL OTHER STREETS` with `-` values → skip if no value
- Output: array of `{ city, barangay, streetOrSubd, classification, zonalValuePhp, rdoSource }`
- Insert into `ZonalValue` table via Prisma

#### Task E2: Create Metro Manila seed script

- **File:** `scripts/seed-metro-manila.ts` (new)
- Pattern follows existing `scripts/seed-metro-cebu.ts`
- Hardcoded `GovernmentReference` records for Metro Manila cities:
  - Manila (16 districts, 897 barangays — seed major ones ~50)
  - Mandaluyong (27 barangays)
  - Pasig (30 barangays)
  - Makati (33 barangays)
  - Quezon City (142 barangays — seed major ~50)
  - Taguig (28 barangays)
  - San Juan (21 barangays)
  - Pasay (201 barangays — seed major areas)
- Each with: `zonalValuePhp`, `landClassification`, `phivolcsRisk`, `floodRisk`, `barangayMultiplier`, `priceTrend6m`
- Use realistic 2025 values (not the 2011/2019 CSV values — those are historical)

---

## Frontend TypeScript Types (add to api.ts)

```typescript
interface RiskAssessmentResponse {
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
```

---

## Nx Workspace Changes

### Web (apps/gavai/web)

```bash
pnpm add recharts
```

### NestJS (apps/gavai/nest)

```bash
pnpm add pmtiles @mapbox/vector-tile @turf/turf
```

### Prisma Schema

```bash
pnpm nx run @gavai/platform:prisma-migrate -- --name add-area-risk-scores
```

---

## Cost Estimate

| Service                 | Usage                                    | Monthly Cost                |
| ----------------------- | ---------------------------------------- | --------------------------- |
| HuggingFace PMTiles CDN | ~5000 tile requests                      | $0 (free)                   |
| Google Distance Matrix  | ~200 barangay-centroids × 3 time windows | ~$3 once, then cached       |
| Google Elevation API    | ~1000 queries                            | Free tier (100K/mo free)    |
| Gemini Flash            | Shared with area intelligence            | ~$0.40/mo                   |
| BrightData              | Shared with area intelligence            | ~$2/mo                      |
| **Total incremental**   |                                          | **~$5 one-time + $2.40/mo** |

---

## Subagent Execution Plan (Parallel Streams)

These 4 streams can run **simultaneously** across separate agents:

| Stream                   | Tasks      | Agent   | Depends On                                |
| ------------------------ | ---------- | ------- | ----------------------------------------- |
| **A — Map Enhancements** | A1, A2, A3 | Agent 1 | Nothing                                   |
| **B — Flood PMTiles**    | B1, B2     | Agent 2 | Nothing                                   |
| **C — Traffic + Yield**  | C1, C2     | Agent 3 | Existing GoogleMapsService, GeminiService |
| **E — BIR Data**         | E1, E2     | Agent 4 | Nothing                                   |

**After Streams A–E complete, run sequentially:**

| Stream                   | Tasks      | Agent          | Depends On                                    |
| ------------------------ | ---------- | -------------- | --------------------------------------------- |
| **D1 — MarketPremium**   | D1         | Agent 5        | Existing ValuationService, ZonalLookupService |
| **D2 — API Module**      | D2         | Agent 5 (same) | B, C, D1 (services exist)                     |
| **D3+D4+D5 — UI Wiring** | D3, D4, D5 | Agent 6        | D2 (API endpoint exists)                      |

---

## Verification Checklist

- [ ] Map loads centered on Metro Manila at zoom 12
- [ ] Satellite toggle switches between roadmap and satellite with 3D tilt
- [ ] Elevation appears next to pin marker after click
- [ ] `GET /area/risk-assessment?lat=14.5995&lng=120.9842` returns all 5 scores
- [ ] Flood score is 0.0–1.0 with level metadata
- [ ] Traffic score varies by time of day (AM vs PM peak)
- [ ] Yield score correlates with development news in area
- [ ] Market premium shows ratio > 1.0 for Metro Manila
- [ ] Spider chart renders 5-axis polygon in ValuationPanel
- [ ] Color coding: green ≥ 0.7, yellow 0.4–0.7, red < 0.4
- [ ] Spider chart only appears after AVM valuation completes
- [ ] `pnpm nx typecheck @gavai/nest @gavai/web` passes
- [ ] `pnpm nx lint @gavai/nest @gavai/web` passes

---

## Future Work (Post-Hackathon)

- [ ] **Fault score** — load PHIVOLCS KMZ → PostGIS → ST_Distance scoring (GitHub issue: `production-spatial`)
- [ ] **Landslide + Storm Surge** — expose as separate spider axes or combined "natural hazard" axis
- [ ] **KDE heatmap toggle** — overlay flood hazard tiles from PMTiles on the map as toggleable layers
- [ ] **Price trajectory axis** — YoY listing price change from scraped data (replaces or supplements market premium)
- [ ] **Full BIR zonal coverage** — all ~120 RDOs, automate PDF scraping from BIR CDN
- [ ] **PMTiles → PostGIS** — download shapefiles, load into PostGIS, server-side ST_Within queries (faster, more reliable)
