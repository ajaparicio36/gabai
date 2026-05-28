# 04 — Data Pipeline

## Overview

The data pipeline collects property listings, enriches them with location and government data, and feeds approved records into the training pool. It runs through the admin dashboard with manual review gates at key stages.

```
Discover (admin) → Review URLs → Queue selected
  → Scrape (BullMQ workers) → Auto-flag suspicious records
  → Admin review → Approve/reject records
  → Enrichment (geocoding + proximity + gov join)
  → Training pool (approved records ready for model training)
```

---

## Stage 1 — Discover

**Trigger:** Admin enters location + property type in the admin dashboard, clicks "Run Discover."

**Backend:** Calls BrightData Discover API with a constructed query.

```typescript
// apps/gavai/nest/src/modules/admin/discover.controller.ts
@Post('admin/discover')
@UseGuards(JwtAuthGuard, AdminGuard)
async runDiscover(@Body() dto: DiscoverDto) {
  const query = `property for sale ${dto.propertyType} ${dto.location} Philippines`;
  const res = await this.brightdata.discover({ query, output: 'urls', limit: 30 });

  const newTargets = [];
  for (const url of res.urls) {
    const urlHash = createHash('sha256').update(url).digest('hex');
    const exists = await this.prisma.scrapingTarget.findUnique({ where: { urlHash } });
    if (!exists) {
      newTargets.push({
        url,
        urlHash,
        status: 'pending_review',
        location: dto.location,
        propertyType: dto.propertyType,
      });
    }
  }

  await this.prisma.scrapingTarget.createMany({ data: newTargets, skipDuplicates: true });
  return { discovered: newTargets.length, duplicatesSkipped: res.urls.length - newTargets.length };
}
```

**Admin UI:** Table of discovered URLs — site name, sample title, estimated count. Admin checks/unchecks rows, clicks "Queue selected."

```
POST /admin/discover/approve  — { ids: string[] }
→ Sets status to 'queued' on selected ScrapingTarget rows
```

---

## Stage 2 — Scrape

**Trigger:** Admin clicks "Run Scraper" in the Scrape tab.

**Backend:** Dispatches BullMQ jobs for all `status: queued` targets.

```typescript
@Post('admin/scrape/run')
@UseGuards(JwtAuthGuard, AdminGuard)
async runScrape() {
  const targets = await this.prisma.scrapingTarget.findMany({
    where: { status: 'queued' },
  });
  for (const target of targets) {
    await this.scrapeQueue.add('scrape-url', { targetId: target.id, url: target.url });
  }
  return { queued: targets.length };
}
```

### BullMQ Worker

```typescript
// apps/gavai/nest/src/modules/pipeline/scraping.worker.ts
@Processor('scraping')
export class ScrapingProcessor {
  @Process('scrape-url')
  async handleScrape(job: Job<{ targetId: string; url: string }>) {
    const raw = await this.brightdata.scrape({
      url: job.data.url,
      schema: LISTING_SCHEMA,
    });

    for (const record of raw.results) {
      const flags = this.applyAutoFlagRules(record);
      await this.prisma.pendingTrainingRecord.create({
        data: {
          ...record,
          sourceUrl: job.data.url,
          status: 'pending_review',
          flagged: flags.length > 0,
          flagReason: flags.join('; ') || null,
        },
      });
    }

    await this.prisma.scrapingTarget.update({
      where: { id: job.data.targetId },
      data: {
        status: 'done',
        scrapedAt: new Date(),
        recordCount: raw.results.length,
      },
    });
  }
}
```

### BrightData Scraper Schema

Essential fields only — cut down to what the model actually needs:

```json
{
  "title": "string",
  "asking_price_php": "number",
  "lot_area_sqm": "number | null",
  "floor_area_sqm": "number | null",
  "bedrooms": "number | null",
  "bathrooms": "number | null",
  "property_type": "string",
  "address_raw": "string",
  "barangay": "string | null",
  "city": "string",
  "developer": "string | null",
  "listing_date": "string"
}
```

### Auto-Flag Rules

Applied at insert time to every scraped record:

| Rule                  | Condition                                                                            | Flag Reason                                    |
| --------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Missing price         | `asking_price_php` is null or < 100,000                                              | "Price missing or implausibly low"             |
| Implausible area      | `lotAreaSqm > 50000` or `floorAreaSqm > 10000`                                       | "Area implausibly large"                       |
| Missing price per sqm | `asking_price_php` present but cannot compute `pricePerSqmPhp`                       | "Cannot compute per-sqm price"                 |
| Duplicate address     | Address fuzzy-match within 10m of existing approved `Property`                       | "Likely duplicate listing"                     |
| Foreclosed keyword    | Title contains: "foreclosed", "bank acquired", "pag-ibig acquired", "acquired asset" | "Foreclosed property — excluded from training" |

Foreclosed-flagged records get `listingType: 'foreclosed'` and are **excluded from training** but still stored for analysis.

### Admin Review

Admin sees a table of scraped `PendingTrainingRecord` rows. Flagged rows are highlighted. Admin can:

- **Approve** (bulk or individual) → moves to enrichment queue
- **Reject** → marks as rejected, excluded from training
- **Edit** → correct flag fields before approving

```
POST /admin/scrape/approve  — { ids: string[] }
→ Sets status to 'approved', dispatches enrichment jobs
```

---

## Stage 3 — Enrichment

After approval, each record goes through the enrichment pipeline. This can run as BullMQ jobs or synchronously during approval.

### 3a. Google Geocoding

```typescript
async geocode(record: PendingTrainingRecord): Promise<{ lat: number; lng: number; googlePlaceId: string } | null> {
  const query = `${record.addressRaw}, ${record.city}, Philippines`;
  const res = await this.mapsClient.geocode({ params: { address: query, key: GOOGLE_MAPS_KEY } });

  const result = res.data.results[0];
  if (!result) return null;

  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    googlePlaceId: result.place_id,
  };
}
```

Cost: $5/1,000 requests. Structural address components (`route`, `sublocality_level_1`, `locality`) extracted for address normalization. `place_id` used as canonical dedup key.

### 3b. Google Places — Nearby Search

One call per amenity category (4 calls) per property:

```typescript
const AMENITY_QUERIES = [
  { type: 'school', label: 'schools', maxDistance: 1500 },
  { type: 'hospital', label: 'hospitals', maxDistance: 3000 },
  { type: 'shopping_mall', label: 'malls', maxDistance: 2000 },
  { type: 'transit_station', label: 'transport', maxDistance: 1000 },
];

// Score = 1 - (distance_m / maxDistance), clamped 0-1
```

### 3c. Google Distance Matrix

For the closest result per amenity category, compute driving travel time. Travel time is a stronger price signal than straight-line distance in the Philippines.

```
Travel time score = 1 - (travel_seconds / 1800), clamped 0–1
```

### 3d. Proximity Score Computation

All categories combined into a single `M_prox` multiplier stored on the `Property` record:

| Positive Factor   | Weight | Max Distance | Decay            |
| ----------------- | ------ | ------------ | ---------------- |
| Premium school    | +0.18  | 1,500m       | Linear to 3,000m |
| Business district | +0.20  | 3,000m       | Linear to 4,500m |
| Shopping mall     | +0.15  | 2,000m       | Linear           |
| Public transit    | +0.12  | 1,000m       | Linear           |

| Negative Factor | Weight | Condition                     |
| --------------- | ------ | ----------------------------- |
| Flood: high     | -0.25  | Barangay-level lookup         |
| Flood: medium   | -0.12  | Barangay-level lookup         |
| Flood: low      | -0.05  | Barangay-level lookup         |
| Earthquake risk | -0.09  | Barangay-level PHIVOLCS score |

Final score clamped to [0.50, 1.50].

### 3e. Government Reference Join

After geocoding, join `GovernmentReference` by `barangay + city`:

```typescript
const govRef = await this.prisma.governmentReference.findUnique({
  where: { barangay_city: { barangay: record.barangay, city: record.city } },
});

// Write to Property
await this.prisma.property.update({
  data: {
    zonalValuePhp: govRef?.zonalValuePhp,
    landClassification: govRef?.landClassification,
    phivolcsRisk: govRef?.phivolcsRisk,
    floodRisk: govRef?.floodRisk,
  },
});
```

This is a simple DB join — free and fast at runtime.

### 3f. C_rep Tier Inference

Infer build quality from **neighborhood median** (not the property's own price) + developer brand:

```typescript
function inferCrepTier(
  neighborhoodMedianPricePerSqm: number,
  developer: string | null,
): CrepResult {
  const devTier = developerTier(developer); // maps known developers to tiers

  let tierPrice: number;
  if (devTier) {
    // Developer brand overrides neighborhood inference
    tierPrice = CREP_TIERS[devTier];
  } else {
    // Fallback: neighborhood median per-sqm band
    tierPrice = inferFromPrice(neighborhoodMedianPricePerSqm);
  }

  return { tier: tierPrice.tier, crepPhp: tierPrice.value };
}

const CREP_TIERS = [
  { tier: 'economy', minPrice: 0, value: 15000 },
  { tier: 'standard', minPrice: 25000, value: 23000 },
  { tier: 'medium', minPrice: 45000, value: 36500 },
  { tier: 'high_end', minPrice: 80000, value: 62500 },
  { tier: 'luxury', minPrice: 130000, value: 100000 },
];

const DEVELOPER_TIERS = {
  luxury: ['Ayala Land Premier', 'Rockwell', 'Shang Properties', 'Alveo'],
  high_end: ['Avida', 'DMCI Homes', 'Filinvest'],
  standard: ['Camella', 'Phinma Properties', 'Deca Homes'],
  economy: ['BellaVita', 'Lessandra', 'Phirst Park Homes'],
};
```

---

## Missing Data Threshold

When assembling a valuation request, the system checks data completeness:

| Condition                                    | Action                       |
| -------------------------------------------- | ---------------------------- |
| `askingPricePhp` missing                     | Refuse valuation             |
| Both `lotAreaSqm` AND `floorAreaSqm` missing | Refuse valuation             |
| `buildingAgeYears` missing                   | Impute with barangay median  |
| 2+ proximity scores missing                  | Mark as low confidence       |
| Other fields missing                         | Impute with area median/mode |

A `dataCompleteness` score (0.0–1.0) is returned alongside the valuation. The UI can gray out or flag low-completeness results.

---

## Foreclosed Property Handling

**Scrape-time:** Keyword filter on `title` + `description_raw`:

- `foreclosed`, `bank acquired`, `pag-ibig acquired`, `acquired asset`, `foreclosure`

Flagged records get `listingType: 'foreclosed'` and are **excluded from model training**. They remain stored for separate analysis.

See future GitHub issue: `foreclosed-asset-handling` for proper modeling in production.

---

## Cost Estimates (2,000 properties)

| Service                | Usage                 | Cost                  |
| ---------------------- | --------------------- | --------------------- |
| BrightData Web Scraper | 2,000 listing scrapes | ~$20 from $250 credit |
| BrightData Discover    | 50 queries            | ~$5                   |
| Google Geocoding       | 2,000 addresses       | ~$10                  |
| Google Places Nearby   | 2,000 × 4 queries     | ~$32                  |
| Google Distance Matrix | 2,000 × 4 elements    | ~$10                  |
| **Total**              |                       | **~$77**              |
