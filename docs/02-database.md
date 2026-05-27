# 02 — Database Schema

## Overview

PostgreSQL 16 with PostGIS extension. Prisma as ORM. Spatial queries use `Unsupported` type declarations with raw SQL via `$queryRaw` / `$executeRaw`.

---

## PostGIS Setup

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Spatial index on the `Property` table's coordinates:

```sql
CREATE INDEX property_location_idx ON "Property"
  USING GIST (ST_SetSRID(ST_MakePoint(lng, lat), 4326));
```

We do not declare PostGIS geometry columns in the Prisma schema directly — Prisma has no native PostGIS type support. Instead, the `lat` and `lng` columns are standard `Float` columns in Prisma. Spatial indexes and queries are managed via raw SQL migrations.

---

## Full Prisma Schema

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id             String       @id @default(cuid())
  email          String       @unique
  passwordHash   String
  role           String       @default("user") // "user" | "admin"
  tier           String       @default("free") // "free" | "paid"
  emailVerified  Boolean      @default(false)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  refreshTokens  RefreshToken[]
  apiKeys        ApiKey[]
}

model RefreshToken {
  id        String    @id @default(cuid())
  tokenHash String    @unique // SHA-256 of opaque token
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
}

model ApiKey {
  id          String    @id @default(cuid())
  keyHash     String    @unique // SHA-256 of the API key
  keyPrefix   String    // First 8 chars for display: "gabai_sk_AbCd1234"
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tier        String    @default("free") // "free" | "paid"
  rateLimit   Int       @default(100)    // requests per hour
  expiresAt   DateTime?
  revokedAt   DateTime?
  lastUsedAt  DateTime?
  createdAt   DateTime  @default(now())

  @@index([userId])
}

model Property {
  id                 String   @id @default(cuid())
  sourceUrl          String?
  scrapedAt          DateTime
  rawTitle           String?
  addressRaw         String?
  googlePlaceId      String?  // Google Maps canonical place ID for dedup
  city               String?
  barangay           String?
  lat                Float?
  lng                Float?
  propertyType       String   // residential_lot | house_and_lot | condo | commercial
  listingType        String   @default("standard") // standard | foreclosed
  lotAreaSqm         Float?
  floorAreaSqm       Float?
  bedrooms           Int?
  bathrooms          Int?
  buildingAgeYears   Int?
  developer          String?
  askingPricePhp     Float
  pricePerSqmPhp     Float?
  listingDate        DateTime?
  zonalValuePhp      Float?
  landClassification String?
  proximityScores    Json?    // { schools, hospitals, malls, transport, business_district }
  phivolcsRisk       Float?
  floodRisk          Float?
  crepTier           String?  // economy | standard | medium | high_end | luxury
  crepPhp            Float?   // replacement cost PHP/sqm, inferred from neighborhood + developer
  userSubmitted      Boolean  @default(false)
  approved           Boolean  @default(false)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  valuations         Valuation[]

  @@index([lat, lng])
  @@index([barangay, city])
  @@index([propertyType])
  @@index([googlePlaceId])
  @@index([listingType])
}

model Valuation {
  id                  String   @id @default(cuid())
  inputLat            Float?
  inputLng            Float?
  inputAddress        String?
  propertyType        String
  lotAreaSqm          Float?
  floorAreaSqm        Float?
  pointEstimatePhp    Float
  confidenceLowPhp    Float
  confidenceHighPhp   Float
  confidenceScore     Float
  dataCompleteness    Float    @default(1.0) // 0-1: how many features were available
  comparablesUsed     Json     // array of Property IDs with their weights
  proximityBreakdown  Json
  birCompliance       Json?    // { complianceFloorPhp, auditRiskScore, riskLabel }
  modelVersion        String
  createdAt           DateTime @default(now())
  property            Property? @relation(fields: [propertyId], references: [id])
  propertyId          String?
  report              Report?
}

model Report {
  id               String    @id @default(cuid())
  valuationId      String    @unique
  valuation        Valuation @relation(fields: [valuationId], references: [id])
  pdfUrl           String
  verificationHash String    @unique
  createdAt        DateTime  @default(now())
}

model AreaIntelligence {
  id             String   @id @default(cuid())
  latKey         Float
  lngKey         Float
  radiusM        Int      @default(1500)
  bulletPoints   String[] // Gemini output, stored as string array
  sourceArticles Json     // { url, title, date }
  fetchedAt      DateTime @default(now())
  expiresAt      DateTime // fetchedAt + 24h

  @@unique([latKey, lngKey, radiusM])
}

model ScrapingJob {
  id          String    @id @default(cuid())
  source      String
  status      String    // queued | running | done | failed
  startedAt   DateTime?
  completedAt DateTime?
  recordCount Int?
  errorLog    String?
  createdAt   DateTime  @default(now())
}

model ScrapingTarget {
  id            String   @id @default(cuid())
  url           String   @unique
  urlHash       String   @unique
  status        String   // pending_review | queued | scraping | done | failed
  location      String?
  propertyType  String?
  discoveredAt  DateTime @default(now())
  scrapedAt     DateTime?
  recordCount   Int?
  errorLog      String?
}

model PendingTrainingRecord {
  id             String    @id @default(cuid())
  sourceUrl      String?
  status         String    // pending_review | approved | rejected
  title          String?
  addressRaw     String?
  city           String?
  barangay       String?
  propertyType   String?
  lotAreaSqm     Float?
  floorAreaSqm   Float?
  bedrooms       Int?
  bathrooms      Int?
  askingPricePhp Float?
  pricePerSqmPhp Float?
  listingDate    DateTime?
  developer      String?
  flagged        Boolean   @default(false)
  flagReason     String?
  createdAt      DateTime  @default(now())
}

model GovernmentReference {
  id                 String   @id @default(cuid())
  barangay           String
  city               String
  zonalValuePhp      Float?
  landClassification String?
  phivolcsRisk       Float?
  floodRisk          Float?
  barangayMultiplier Float?   // location multiplier for formula-based valuation
  priceTrend6m       Float?   // 6-month price momentum
  lguAssessedValue   Float?
  assessmentLevel    Float?
  farMultiplier      Float?   // floor area ratio, for commercial
  updatedAt          DateTime @updatedAt

  @@unique([barangay, city])
}

model ZonalValue {
  id            String   @id @default(cuid())
  city          String
  barangay      String
  streetOrSubd  String?
  zoneType      String   // 'street' | 'subdivision'
  zonalValuePhp Float
  rdoSource     String   // e.g. 'cebu_city_north'
  extractedAt   DateTime @default(now())

  @@index([barangay, city])
  @@index([city])
}

model ModelVersion {
  id              String    @id @default(cuid())
  version         String    @unique // e.g. "20250527-143200"
  modelPath       String            // path to .pkl on disk
  status          String            // training | ready | deployed | archived
  mape            Float?
  trainingRecords Int?
  jobId           String?
  deployedAt      DateTime?
  createdAt       DateTime  @default(now())
}
```

---

## Spatial Query Pattern

Since Prisma doesn't support `ST_DWithin` or `ST_Distance` natively, all spatial queries use `$queryRaw` or `$queryRawUnsafe`:

```typescript
// libs/platform/src/spatial.ts
import { PrismaService } from './prisma.service';

@Injectable()
export class SpatialService {
  constructor(private readonly prisma: PrismaService) {}

  async getComparables(
    lat: number,
    lng: number,
    radiusM: number,
    propertyType: string,
  ) {
    return this.prisma.$queryRaw<ComparableRow[]>`
      SELECT *, ST_Distance(
        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      ) AS distance_m
      FROM "Property"
      WHERE ST_DWithin(
        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radiusM}
      )
      AND "propertyType" = ${propertyType}::text
      AND "pricePerSqmPhp" IS NOT NULL
      AND "listingType" = 'standard'
      AND "approved" = true
      ORDER BY distance_m ASC
      LIMIT 20
    `;
  }
}
```

**Note:** `ST_SetSRID(ST_MakePoint(lng, lat), 4326)` is called per-row. For production at scale, pre-compute a `geography` column and index it. For hackathon data volumes (~500-2000 properties), this is fine.

---

## Migration Workflow

```bash
# Create a new migration after schema changes
pnpm nx run @gabai/platform:prisma-migrate -- --name <migration_name>

# Apply pending migrations
pnpm nx run @gabai/platform:prisma-migrate -- --status

# Seed the database
pnpm nx run @gabai/platform:prisma-seed
```

Migrations that add PostGIS functionality must manually add `CREATE EXTENSION IF NOT EXISTS postgis;` as the first statement in `up()` and spatial index creation statements.

---

## Key Indexes

| Table               | Index                            | Purpose                                |
| ------------------- | -------------------------------- | -------------------------------------- |
| Property            | GIST on (lng, lat)               | Spatial radius queries for comparables |
| Property            | (barangay, city)                 | Filter by location                     |
| Property            | (propertyType)                   | Filter by type                         |
| Property            | (googlePlaceId)                  | Deduplication                          |
| Property            | (listingType)                    | Exclude foreclosed from training       |
| GovernmentReference | (barangay, city) UNIQUE          | Gov data join at enrichment            |
| ZonalValue          | (barangay, city)                 | Zonal value lookup                     |
| AreaIntelligence    | (latKey, lngKey, radiusM) UNIQUE | Cache key                              |
| ScrapingTarget      | (urlHash) UNIQUE                 | Deduplication                          |
| RefreshToken        | (userId)                         | Token lookup by user                   |
| ApiKey              | (keyHash) UNIQUE                 | Key validation                         |

---

## Currency Convention

All PHP values are stored as **floats** (not integers in centavos). Property values in the Philippines are typically in the millions of pesos; sub-centavo precision is irrelevant. Prices are displayed rounded to the nearest peso in the UI.

This is a deliberate deviation from the financial software convention of integer-centavo storage, chosen for simplicity and because:

1. PHP property values are large (millions)
2. No financial transactions occur within the system (only valuations and API billing via Xendit)
3. Prisma's Float maps cleanly to PostgreSQL `double precision`
