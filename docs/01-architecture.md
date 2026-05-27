# 01 — Architecture Overview

## What is GABAI?

GABAI is an AI-powered **Automated Valuation Model (AVM)** for Philippine real estate. It scrapes property listings, enriches them with government and location data, trains an XGBoost regression model, and provides instant property valuations with confidence bands. A Google Maps frontend offers three views: heatmap, listings-only, and valuation+intelligence.

**Scope:** Hackathon demo focused on Metro Cebu. Extensible to national coverage post-launch.

---

## Tech Stack

| Layer                  | Technology                                          | Purpose                                          |
| ---------------------- | --------------------------------------------------- | ------------------------------------------------ |
| Monorepo               | Nx 22                                               | Build orchestration, task caching, project graph |
| Package manager        | pnpm                                                | Workspace management                             |
| Backend                | NestJS 11                                           | REST API, auth, BullMQ job dispatch              |
| Frontend               | Next.js 16 (App Router)                             | Map UI, admin dashboard, auth pages              |
| ML sidecar             | Python 3.12 / FastAPI                               | XGBoost inference, model retraining, hot-swap    |
| Database               | PostgreSQL 16 + PostGIS                             | Spatial queries, property records, cache         |
| ORM                    | Prisma                                              | Schema management, migrations, type-safe queries |
| Cache / Queue          | Redis 7                                             | BullMQ job queues, heatmap tile cache            |
| Search / Autocomplete  | Google Maps JS API                                  | Frontend map rendering, geocoding                |
| Geocoding / Enrichment | Google Geocoding, Places, Distance Matrix           | Address → lat/lng, amenity proximity             |
| Scraping               | BrightData Web Scraper, Discover, Browser API, SERP | Property listings, area news, POI                |
| LLM                    | Gemini 2.0 Flash                                    | Area news summarization                          |
| Payments               | Xendit (sandbox)                                    | Pay-as-you-go API access                         |
| Auth                   | NestJS passport + JWT                               | Access/refresh tokens, admin role, API keys      |

---

## Monorepo Structure

```
gabai/
├── apps/gabai/
│   ├── nest/           ← NestJS API server (HTTP + BullMQ workers)
│   ├── web/            ← Next.js frontend (App Router, Tailwind)
│   └── sidecar/        ← Python FastAPI ML inference service
├── libs/
│   ├── platform/       ← Prisma client, schema, migrations, DB service
│   ├── shared-types/   ← TypeScript types, Zod schemas, shared DTOs
│   └── pipeline/       ← Scraping strategies, enrichment logic, geocoding
├── scripts/
│   ├── train.py         ← XGBoost training script
│   └── bir_zonal_pipeline.py  ← BIR PDF extraction
├── models/
│   └── avm.pkl          ← Committed trained model weights
├── docs/                ← This documentation set
└── docker-compose.yml   ← Local dev + deployment orchestration
```

**Package naming convention:** `@gabai/<name>` — e.g., `@gabai/platform`, `@gabai/shared-types`.

---

## Service Communication

```
┌──────────────────────────────────────────────────────────────┐
│  Browser (Google Maps JS)                                    │
│  └─► Next.js (apps/web)                                      │
│      └─► NestJS API (apps/nest)  ──HTTP──►  Python ML        │
│          │                       REST      (apps/sidecar)    │
│          ├─► PostgreSQL + PostGIS                             │
│          ├─► Redis (BullMQ + cache)                           │
│          ├─► BrightData API (scraping)                        │
│          ├─► Google Maps API (geocoding, places, distance)    │
│          ├─► Gemini API (summarization)                       │
│          └─► Xendit API (payments)                            │
└──────────────────────────────────────────────────────────────┘
```

- **NestJS ↔ ML sidecar**: HTTP REST. NestJS assembles feature vectors and POSTs to `/infer`. Inference is stateless.
- **NestJS ↔ BullMQ**: In-process workers (same Node process), Redis-backed queue persistence.
- **NestJS ↔ Database**: Prisma client with PostGIS spatial queries via `$queryRaw`.

---

## Decisions Log

| Decision               | Choice                                                         | Rationale                                                             |
| ---------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------- |
| Spatial queries        | PostGIS via `Unsupported` type + `$queryRaw`                   | Prisma lacks native PostGIS support; raw SQL gives full spatial power |
| Currency               | Float                                                          | PHP property values in millions; sub-centavo precision irrelevant     |
| Primary model          | Single XGBoost, property type one-hot encoded                  | Avoids per-type data sparsity, simpler deployment                     |
| C_rep tier inference   | Neighborhood median + developer brand tier                     | Breaks circular dependency with asking price                          |
| Bootstrap (cold start) | Formula heuristics for types with <50 records                  | Gives defensible estimates at zero training data                      |
| Confidence scoring     | Comparables density + data completeness heuristic              | Simple, transparent; quantile regression filed as future issue        |
| Address normalization  | Google Geocoding `address_components` + `place_id`             | Already paid for; structured output; canonical dedup key              |
| Missing data handling  | Tiered refusal (see [04-data-pipeline](./04-data-pipeline.md)) | Never return garbage; communicate uncertainty                         |
| Foreclosed properties  | Keyword filter + exclude from training                         | 30-50% below market; would bias model; filed as future issue          |
| Gemini usage           | Summarize-only, source attribution required                    | Prevents hallucination of fake infrastructure projects                |
| Python version         | 3.12                                                           | 3.9 is EOL; 3.12 is current stable                                    |
| ORM                    | Prisma (not MikroORM)                                          | Simpler schema-first approach; better team familiarity                |
| Admin seeding          | Prisma seed file                                               | Standard Prisma workflow                                              |
| Admin auth             | NestJS passport JWT + role guard                               | Standard NestJS pattern                                               |
| Refresh tokens         | Opaque, SHA-256 hashed, DB-tracked, revocable                  | Security best practice for token revocation                           |
| Rate limiting          | NestJS ThrottlerModule                                         | Built-in NestJS solution                                              |
| User auth              | Email/password                                                 | Simple; Google OAuth filed as future issue                            |
| Payments               | Xendit sandbox                                                 | Pay-as-you-go API access; sandbox for hackathon                       |
| Dev workflow           | Local without Docker supported                                 | Docker for deployment only; `pnpm nx serve` for local dev             |

---

## Key Design Principles

1. **Transparency over black-box.** Every valuation shows confidence bands, data completeness, and source attributions. "This model could be wrong" is always visible.
2. **Progressive data quality.** The model gets better as more data is scraped and reviewed. UI communicates training record count and MAPE.
3. **Separate concerns by tier.** Free tier: heatmap, listings. Registered tier: area intelligence. Paid tier: valuation + reports.
4. **Admin owns the pipeline.** Discover → scrape → train → deploy is a UI-driven lifecycle. No terminal access needed for model iteration.
5. **Fail gracefully.** BrightData down? Show stale data. ML sidecar down? Return formula-based estimate. Always degrade, never crash.
