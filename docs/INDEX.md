# GABAI — Implementation Tracker

AI-powered Automated Valuation Model for Philippine real estate.

> **Decision:** Valuation, heatmap, area-intelligence, and report endpoints are **internal-only** (called by our Next.js frontend, not exposed as a public API). The paid-tier `/valuation` external API and Xendit payment flow are deferred pending discussion. See `[D]` marker.

---

## Status Legend

| Marker | Meaning                                        |
| ------ | ---------------------------------------------- |
| `[ ]`  | Not started                                    |
| `[~]`  | In progress                                    |
| `[x]`  | Done                                           |
| `[D]`  | Deferred (internal-only / no external API yet) |

---

## Phase 0 — Foundation

| Status | Task                                                                     | Detail Doc                                   |
| ------ | ------------------------------------------------------------------------ | -------------------------------------------- |
| `[x]`  | Nx monorepo scaffold                                                     | [01-architecture.md](./01-architecture.md)   |
| `[x]`  | NestJS app generated (`apps/gabai/nest`)                                 | —                                            |
| `[x]`  | Next.js app generated (`apps/gabai/web`)                                 | —                                            |
| `[x]`  | Python sidecar generated (`apps/gabai/sidecar`)                          | —                                            |
| `[x]`  | ESLint, Jest, Prettier, commitlint, husky configured                     | —                                            |
| `[ ]`  | `libs/platform` NestJS lib generated (Prisma client, schema, migrations) | [02-database.md](./02-database.md)           |
| `[ ]`  | `libs/shared-types` lib generated (TypeScript types, Zod schemas, DTOs)  | [06-api-design.md](./06-api-design.md)       |
| `[ ]`  | `libs/pipeline` lib generated (scraping, enrichment, geocoding services) | [04-data-pipeline.md](./04-data-pipeline.md) |
| `[ ]`  | AGENTS.md updated with GABAI project details                             | —                                            |

---

## Phase 1 — Core Infrastructure

| Status | Task                                                        | Detail Doc                                     |
| ------ | ----------------------------------------------------------- | ---------------------------------------------- |
| `[ ]`  | Prisma schema: all models defined                           | [02-database.md](./02-database.md)             |
| `[ ]`  | PostGIS extension enabled, spatial index created            | [02-database.md](./02-database.md)             |
| `[ ]`  | Prisma migration: initial schema                            | [02-database.md](./02-database.md)             |
| `[ ]`  | `DATABASE_URL` in `.env` (local Postgres)                   | [10-infrastructure.md](./10-infrastructure.md) |
| `[ ]`  | Redis running locally, `REDIS_URL` in `.env`                | [10-infrastructure.md](./10-infrastructure.md) |
| `[ ]`  | `.env.example` created with all required vars               | [10-infrastructure.md](./10-infrastructure.md) |
| `[ ]`  | Docker Compose: `api`, `web`, `ml`, `db` (postgis), `redis` | [10-infrastructure.md](./10-infrastructure.md) |
| `[ ]`  | Per-project Dockerfiles (nest, web, sidecar)                | [10-infrastructure.md](./10-infrastructure.md) |
| `[ ]`  | BullMQ queues: `scraping`, `enrichment`, `heatmap-regen`    | [04-data-pipeline.md](./04-data-pipeline.md)   |
| `[ ]`  | NestJS config module: validated env vars                    | [10-infrastructure.md](./10-infrastructure.md) |
| `[ ]`  | Python sidecar bumped to Python 3.12                        | [05-avm-engine.md](./05-avm-engine.md)         |

---

## Phase 2 — Auth & Users

| Status | Task                                                                                | Detail Doc                 |
| ------ | ----------------------------------------------------------------------------------- | -------------------------- |
| `[ ]`  | `User` model: email, password hash, role (user/admin), timestamps                   | [03-auth.md](./03-auth.md) |
| `[ ]`  | `RefreshToken` model: userId, token hash, expiresAt, revokedAt                      | [03-auth.md](./03-auth.md) |
| `[ ]`  | `ApiKey` model: userId, key hash, tier (free/paid), rateLimit, expiresAt, revokedAt | [03-auth.md](./03-auth.md) |
| `[ ]`  | Email/password signup endpoint (`POST /auth/signup`)                                | [03-auth.md](./03-auth.md) |
| `[ ]`  | Login endpoint (`POST /auth/login`) — returns access + refresh tokens               | [03-auth.md](./03-auth.md) |
| `[ ]`  | Refresh endpoint (`POST /auth/refresh`) — rotates refresh token                     | [03-auth.md](./03-auth.md) |
| `[ ]`  | Logout endpoint (`POST /auth/logout`) — revokes refresh token                       | [03-auth.md](./03-auth.md) |
| `[ ]`  | JWT access tokens: 15min expiry, RS256 or HS256                                     | [03-auth.md](./03-auth.md) |
| `[ ]`  | Opaque refresh tokens: 7d expiry, SHA-256 hashed in DB, revocable                   | [03-auth.md](./03-auth.md) |
| `[ ]`  | `JwtAuthGuard` — validates access token, attaches `req.user`                        | [03-auth.md](./03-auth.md) |
| `[ ]`  | `AdminGuard` — checks `req.user.role === 'admin'`                                   | [03-auth.md](./03-auth.md) |
| `[ ]`  | `ApiKeyGuard` — validates API key from `Authorization: Bearer <key>` header         | [03-auth.md](./03-auth.md) |
| `[ ]`  | Prisma seed: insert one admin user                                                  | [03-auth.md](./03-auth.md) |
| `[ ]`  | NestJS ThrottlerModule: rate limit config per guard tier                            | [03-auth.md](./03-auth.md) |
| `[ ]`  | API key generation endpoint (`POST /auth/api-keys`)                                 | [03-auth.md](./03-auth.md) |
| `[ ]`  | API key rotation endpoint (`POST /auth/api-keys/:id/rotate`)                        | [03-auth.md](./03-auth.md) |
| `[D]`  | Xendit sandbox: invoice creation for pay-as-you-go credits                          | [03-auth.md](./03-auth.md) |
| `[D]`  | Xendit webhook: payment success → upgrade user tier, generate API key               | [03-auth.md](./03-auth.md) |
| `[D]`  | Access tier gating: `paid` tier required for `/valuation`, `/report/*`              | [03-auth.md](./03-auth.md) |

---

## Phase 3 — Data Pipeline

| Status | Task                                                                         | Detail Doc                                   |
| ------ | ---------------------------------------------------------------------------- | -------------------------------------------- |
| `[ ]`  | `ScrapingTarget` model: url, urlHash, status, location, propertyType         | [04-data-pipeline.md](./04-data-pipeline.md) |
| `[ ]`  | `PendingTrainingRecord` model: all scraped fields, status, flagged           | [04-data-pipeline.md](./04-data-pipeline.md) |
| `[ ]`  | `ScrapingJob` model: source, status, recordCount, errorLog                   | [04-data-pipeline.md](./04-data-pipeline.md) |
| `[ ]`  | BrightData Discover endpoint (`POST /admin/discover`)                        | [04-data-pipeline.md](./04-data-pipeline.md) |
| `[ ]`  | Admin discover page: query form + URL review table + approve action          | [04-data-pipeline.md](./04-data-pipeline.md) |
| `[ ]`  | BullMQ `scraping` worker: BrightData Web Scraper API per URL                 | [04-data-pipeline.md](./04-data-pipeline.md) |
| `[ ]`  | BrightData scrape schema per site (Lamudi, DotProperty, Property24, OLX)     | [04-data-pipeline.md](./04-data-pipeline.md) |
| `[ ]`  | Auto-flag rules: missing price, implausible area, duplicate address          | [04-data-pipeline.md](./04-data-pipeline.md) |
| `[ ]`  | Admin scrape page: queue list + run button + review table + approve action   | [04-data-pipeline.md](./04-data-pipeline.md) |
| `[ ]`  | Google Geocoding: address → lat/lng, store structured address_components     | [04-data-pipeline.md](./04-data-pipeline.md) |
| `[ ]`  | Google Places Nearby Search: schools, hospitals, malls, transit per property | [04-data-pipeline.md](./04-data-pipeline.md) |
| `[ ]`  | Google Distance Matrix: driving travel time to top-1 amenity per category    | [04-data-pipeline.md](./04-data-pipeline.md) |
| `[ ]`  | Proximity scores computed and stored (0–1)                                   | [04-data-pipeline.md](./04-data-pipeline.md) |
| `[ ]`  | `GovernmentReference` model: barangay + city key, zonalValue, risk scores    | [04-data-pipeline.md](./04-data-pipeline.md) |
| `[ ]`  | Government data seeded for Metro Cebu (BIR zonal, PHIVOLCS, PAGASA)          | [04-data-pipeline.md](./04-data-pipeline.md) |
| `[ ]`  | Gov reference join at enrichment time (fast, free, no API calls)             | [04-data-pipeline.md](./04-data-pipeline.md) |
| `[ ]`  | Foreclosed property keyword filter at scrape time                            | [04-data-pipeline.md](./04-data-pipeline.md) |
| `[ ]`  | C_rep tier inference: neighborhood median + developer brand tier             | [05-avm-engine.md](./05-avm-engine.md)       |
| `[ ]`  | Missing data threshold: tiered refusal logic                                 | [04-data-pipeline.md](./04-data-pipeline.md) |

---

## Phase 4 — AVM Engine

| Status | Task                                                                                  | Detail Doc                             |
| ------ | ------------------------------------------------------------------------------------- | -------------------------------------- |
| `[ ]`  | Feature engineering: full feature set extracted from approved records                 | [05-avm-engine.md](./05-avm-engine.md) |
| `[ ]`  | XGBoost training script (`scripts/train.py`)                                          | [05-avm-engine.md](./05-avm-engine.md) |
| `[ ]`  | Single model with property type one-hot encoded                                       | [05-avm-engine.md](./05-avm-engine.md) |
| `[ ]`  | Formula-based heuristics for property types with <50 records                          | [05-avm-engine.md](./05-avm-engine.md) |
| `[ ]`  | FastAPI sidecar: `/infer` endpoint                                                    | [05-avm-engine.md](./05-avm-engine.md) |
| `[ ]`  | FastAPI sidecar: `/model/info` endpoint                                               | [05-avm-engine.md](./05-avm-engine.md) |
| `[ ]`  | FastAPI sidecar: `/admin/retrain` endpoint (internal)                                 | [05-avm-engine.md](./05-avm-engine.md) |
| `[ ]`  | FastAPI sidecar: `/admin/load` hot-swap endpoint                                      | [05-avm-engine.md](./05-avm-engine.md) |
| `[ ]`  | `ModelVersion` model: version, modelPath, status, mape, trainingRecords               | [05-avm-engine.md](./05-avm-engine.md) |
| `[ ]`  | NestJS `ValuationModule`: assemble features, call ML sidecar via HTTP (internal-only) | [06-api-design.md](./06-api-design.md) |
| `[ ]`  | `POST /valuation` endpoint (internal-only — no public API)                            | [06-api-design.md](./06-api-design.md) |
| `[ ]`  | `GET /valuation/:id` endpoint (internal-only)                                         | [06-api-design.md](./06-api-design.md) |
| `[ ]`  | Confidence scoring: comparables density + data completeness heuristic                 | [05-avm-engine.md](./05-avm-engine.md) |
| `[ ]`  | BIR compliance floor: F_BIR compute + audit risk score (prototype, flagged)           | [09-bir-zonal.md](./09-bir-zonal.md)   |
| `[ ]`  | Heatmap tile endpoint (`GET /heatmap/tiles`) — internal-only                          | [06-api-design.md](./06-api-design.md) |
| `[ ]`  | Quick pin estimate (`GET /heatmap/estimate`) — internal-only                          | [06-api-design.md](./06-api-design.md) |
| `[ ]`  | Admin train page: training pool summary + trigger button + version history            | [07-frontend.md](./07-frontend.md)     |
| `[ ]`  | Admin sandbox preview: read-only map with new model loaded                            | [07-frontend.md](./07-frontend.md)     |
| `[ ]`  | Admin deploy page: version table + Promote button → hot-swap                          | [07-frontend.md](./07-frontend.md)     |

---

## Phase 5 — Area Intelligence

| Status | Task                                                                                       | Detail Doc                                           |
| ------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `[ ]`  | `AreaIntelligence` model: latKey, lngKey, radiusM, bulletPoints, sourceArticles, expiresAt | [08-area-intelligence.md](./08-area-intelligence.md) |
| `[ ]`  | Area key rounding: 500m grid (lat/lng rounded to 3 decimal places)                         | [08-area-intelligence.md](./08-area-intelligence.md) |
| `[ ]`  | Cache lookup: check DB → return cached if valid, else fetch fresh                          | [08-area-intelligence.md](./08-area-intelligence.md) |
| `[ ]`  | BrightData Discover for area news (infrastructure/development queries)                     | [08-area-intelligence.md](./08-area-intelligence.md) |
| `[ ]`  | Gemini Flash summarization: summarize-only, source attribution, no synthesis               | [08-area-intelligence.md](./08-area-intelligence.md) |
| `[ ]`  | `GET /area/intelligence` endpoint (JWT-gated: registered users only, internal-only)        | [06-api-design.md](./06-api-design.md)               |

---

## Phase 6 — Frontend

| Status | Task                                                                          | Detail Doc                         |
| ------ | ----------------------------------------------------------------------------- | ---------------------------------- |
| `[ ]`  | Signup page (`/auth/signup`)                                                  | [07-frontend.md](./07-frontend.md) |
| `[ ]`  | Login page (`/auth/login`)                                                    | [07-frontend.md](./07-frontend.md) |
| `[ ]`  | Google Maps JS API wrapper (`MapContainer`)                                   | [07-frontend.md](./07-frontend.md) |
| `[ ]`  | Three-view toggle: Heatmap / Listings / Valuation                             | [07-frontend.md](./07-frontend.md) |
| `[ ]`  | Heatmap view: GeoJSON tile layer, filter bar (property type, price range)     | [07-frontend.md](./07-frontend.md) |
| `[ ]`  | Listings view: listing pins only, click for details, distinct color for own   | [07-frontend.md](./07-frontend.md) |
| `[ ]`  | Valuation view: drop pin → `/valuation` + `/area/intelligence` calls          | [07-frontend.md](./07-frontend.md) |
| `[ ]`  | `ValuationPanel`: estimate, confidence band, price signal, area intel bullets | [07-frontend.md](./07-frontend.md) |
| `[ ]`  | `ConfidenceBadge`: visual indicator of confidence level                       | [07-frontend.md](./07-frontend.md) |
| `[ ]`  | `AreaIntelCard`: bullet point news card with source attribution               | [07-frontend.md](./07-frontend.md) |
| `[ ]`  | TanStack Query hooks: `useValuation`, `useHeatmap`, `useAreaIntel`            | [07-frontend.md](./07-frontend.md) |
| `[ ]`  | Admin layout: JWT guard + sidebar nav                                         | [07-frontend.md](./07-frontend.md) |
| `[ ]`  | Admin discover page: query form + URL review table + approve                  | [07-frontend.md](./07-frontend.md) |
| `[ ]`  | Admin scrape page: pending queue + run button + review table + approve        | [07-frontend.md](./07-frontend.md) |
| `[ ]`  | Admin train page: pool summary + trigger + version history                    | [07-frontend.md](./07-frontend.md) |
| `[ ]`  | Admin deploy page: version table + Promote + rollback                         | [07-frontend.md](./07-frontend.md) |

---

## Phase 7 — Polish & Demo

| Status | Task                                                                               | Detail Doc                             |
| ------ | ---------------------------------------------------------------------------------- | -------------------------------------- |
| `[ ]`  | PDF report generation (`POST /report/generate`, `GET /report/:id`) — internal-only | [06-api-design.md](./06-api-design.md) |
| `[ ]`  | `Report` model: valuationId, pdfUrl, verificationHash                              | [02-database.md](./02-database.md)     |
| `[ ]`  | Legal disclaimer in UI: "This is not a professional appraisal"                     | [07-frontend.md](./07-frontend.md)     |
| `[ ]`  | Undertrained model caveat in UI                                                    | [07-frontend.md](./07-frontend.md)     |
| `[ ]`  | Demo script / walkthrough prepared                                                 | —                                      |
| `[ ]`  | README.md updated with project description                                         | —                                      |

---

## Future — Post-Hackathon (GitHub Issues)

| Issue                     | Description                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `per-type-min-threshold`  | Per-type minimum training threshold and fallback behavior                            |
| `quantile-regression`     | Quantile regression for proper prediction intervals                                  |
| `foreclosed-handling`     | Foreclosed asset handling — separate model features                                  |
| `per-type-models`         | Evaluate per-type models once >500 records per type exist                            |
| `google-oauth`            | Google OAuth in addition to email/password                                           |
| `user-listing-submission` | Crowd-sourced property listing submission with user ownership                        |
| `income-capitalization`   | Commercial property income capitalization (requires rental data)                     |
| `production-spatial`      | Full PHIVOLCS fault buffer polygons, PAGASA flood polygons (not just barangay-level) |
| `national-expansion`      | Expand BIR zonal pipeline to all RDOs, multi-city scrape                             |
| `transaction-data`        | Integrate actual transaction data (not just asking prices)                           |
| `explainability`          | SHAP values or feature importance in valuation panel                                 |

---

## Module Map (NestJS)

```
apps/gabai/nest/src/
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts        ← signup, login, refresh, logout, api-keys
│   │   ├── auth.service.ts           ← password hashing, token issuance, refresh rotation
│   │   ├── auth.repository.ts        ← User, RefreshToken, ApiKey DB access
│   │   └── guards/
│   │       ├── jwt.guard.ts           ← validates access token
│   │       ├── admin.guard.ts         ← checks role === 'admin'
│   │       └── api-key.guard.ts       ← validates API key + tier check
│   ├── pipeline/
│   │   ├── pipeline.module.ts
│   │   ├── scraping.service.ts       ← BrightData REST calls, BullMQ job dispatch
│   │   ├── scraping.repository.ts
│   │   ├── geocoder.service.ts       ← Google Geocoding + Places + Distance Matrix
│   │   └── enrichment.service.ts     ← Gov reference join, proximity score calc, C_rep inference
│   ├── valuation/
│   │   ├── valuation.module.ts
│   │   ├── valuation.service.ts      ← assemble features, call ML sidecar via HTTP
│   │   ├── valuation.repository.ts
│   │   └── valuation.controller.ts   ← POST /valuation, GET /valuation/:id
│   ├── heatmap/
│   │   ├── heatmap.module.ts
│   │   ├── heatmap.service.ts        ← aggregate per-sqm by geo tile, Redis cache
│   │   └── heatmap.controller.ts     ← GET /heatmap/tiles, GET /heatmap/estimate
│   ├── area/
│   │   ├── area.module.ts
│   │   ├── area-intelligence.service.ts  ← cache lookup → Discover → Gemini
│   │   └── area.controller.ts        ← GET /area/intelligence
│   ├── report/
│   │   ├── report.module.ts
│   │   ├── report.service.ts         ← PDF generation, verification hash
│   │   └── report.controller.ts
│   ├── admin/
│   │   ├── admin.module.ts
│   │   ├── discover.controller.ts    ← POST /admin/discover, POST /admin/discover/approve
│   │   ├── scrape.controller.ts      ← POST /admin/scrape/run, POST /admin/scrape/approve
│   │   ├── train.controller.ts       ← POST /admin/train/run, GET /admin/train/status
│   │   └── deploy.controller.ts      ← POST /admin/deploy/:versionId
│   └── payment/
│       ├── payment.module.ts
│       ├── payment.controller.ts     ← Xendit webhook handler
│       └── payment.service.ts        ← invoice creation, webhook verification
```

---

## Frontend Route Map (Next.js)

```
apps/gabai/web/src/app/
├── layout.tsx                        ← global layout, providers
├── page.tsx                          ← landing / redirect to map
├── auth/
│   ├── login/page.tsx
│   └── signup/page.tsx
├── map/
│   └── page.tsx                      ← main map with three views
├── admin/
│   ├── layout.tsx                    ← admin JWT guard + sidebar
│   ├── discover/page.tsx
│   ├── scrape/page.tsx
│   ├── train/
│   │   ├── page.tsx
│   │   └── sandbox/page.tsx
│   └── deploy/page.tsx
└── api/
    └── (Next.js API routes if needed — prefer NestJS)
```
