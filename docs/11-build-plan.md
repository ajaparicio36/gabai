# 11 — Build Plan (5 Days)

## Day 1 — Infrastructure & Foundation

**Goal:** Everything boots. Database is migrated. Auth works. Docker runs.

| #    | Task                                                                  | Detail                                                               |
| ---- | --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1.1  | Install Prisma dependencies (`@prisma/client`, `prisma`)              | [02-database](./02-database.md)                                      |
| 1.2  | Create `libs/platform` NestJS lib via `nx g @nx/nest:lib`             | Nx generator                                                         |
| 1.3  | Define full Prisma schema (all models)                                | [02-database](./02-database.md)                                      |
| 1.4  | Run `prisma migrate dev` → initial migration                          | —                                                                    |
| 1.5  | Enable PostGIS: `CREATE EXTENSION postgis` + spatial index            | [02-database](./02-database.md)                                      |
| 1.6  | Write `libs/platform/src/prisma.service.ts` (injectable)              | —                                                                    |
| 1.7  | Write `libs/platform/src/spatial.service.ts` (raw SQL helpers)        | [02-database](./02-database.md)                                      |
| 1.8  | Create `.env.example` with all required vars                          | [03-auth](./03-auth.md), [10-infrastructure](./10-infrastructure.md) |
| 1.9  | Set up local PostgreSQL + Redis (Docker or local)                     | [10-infrastructure](./10-infrastructure.md)                          |
| 1.10 | Write `docker-compose.yml` (all services)                             | [10-infrastructure](./10-infrastructure.md)                          |
| 1.11 | Write per-project Dockerfiles (nest, web, sidecar)                    | [10-infrastructure](./10-infrastructure.md)                          |
| 1.12 | Configure NestJS ConfigModule with validated env vars                 | [10-infrastructure](./10-infrastructure.md)                          |
| 1.13 | Set up auth module: User, RefreshToken, ApiKey models                 | [03-auth](./03-auth.md)                                              |
| 1.14 | Implement signup, login, refresh, logout endpoints                    | [03-auth](./03-auth.md)                                              |
| 1.15 | Implement JwtAuthGuard, AdminGuard, ApiKeyGuard                       | [03-auth](./03-auth.md)                                              |
| 1.16 | Write Prisma seed for admin account                                   | [03-auth](./03-auth.md)                                              |
| 1.17 | Set up ThrottlerModule with per-tier rate limits                      | [03-auth](./03-auth.md)                                              |
| 1.18 | Verify: `docker compose up` → all services boot                       | —                                                                    |
| 1.19 | Verify: auth flow works (signup → login → refresh → admin seed login) | —                                                                    |

**Deliverable:** Monorepo boots. Docker Compose running. Auth works end-to-end.

---

## Day 2 — Data Pipeline

**Goal:** BrightData scrape runs. Geocoding enriches records. Government data is seeded.

| #    | Task                                                                               | Detail                                    |
| ---- | ---------------------------------------------------------------------------------- | ----------------------------------------- |
| 2.1  | Generate `libs/pipeline` lib                                                       | Nx generator                              |
| 2.2  | Implement BrightData client service (Discover, Web Scraper, Browser API)           | [04-data-pipeline](./04-data-pipeline.md) |
| 2.3  | Set up BullMQ: Redis config, queue definitions, worker processes                   | [04-data-pipeline](./04-data-pipeline.md) |
| 2.4  | Implement admin discover endpoint + approve flow                                   | [04-data-pipeline](./04-data-pipeline.md) |
| 2.5  | Implement BullMQ scraping worker (BrightData → PendingTrainingRecord)              | [04-data-pipeline](./04-data-pipeline.md) |
| 2.6  | Implement auto-flag rules (missing price, implausible area, duplicate, foreclosed) | [04-data-pipeline](./04-data-pipeline.md) |
| 2.7  | Implement admin scrape approve endpoint (→ enrichment queue)                       | [04-data-pipeline](./04-data-pipeline.md) |
| 2.8  | Implement Google Geocoding service (address → lat/lng + place_id)                  | [04-data-pipeline](./04-data-pipeline.md) |
| 2.9  | Implement Google Places Nearby Search (4 amenity categories)                       | [04-data-pipeline](./04-data-pipeline.md) |
| 2.10 | Implement Google Distance Matrix (travel time to closest POI)                      | [04-data-pipeline](./04-data-pipeline.md) |
| 2.11 | Implement proximity score computation + storage on Property                        | [04-data-pipeline](./04-data-pipeline.md) |
| 2.12 | Implement GovernmentReference join at enrichment time                              | [04-data-pipeline](./04-data-pipeline.md) |
| 2.13 | Seed GovernmentReference table for Metro Cebu (BIR zonal, PHIVOLCS, PAGASA)        | [09-bir-zonal](./09-bir-zonal.md)         |
| 2.14 | Implement C_rep tier inference (neighborhood median + developer brand)             | [05-avm-engine](./05-avm-engine.md)       |
| 2.15 | Implement missing data threshold logic                                             | [04-data-pipeline](./04-data-pipeline.md) |
| 2.16 | Implement foreclosed property keyword filter                                       | [04-data-pipeline](./04-data-pipeline.md) |
| 2.17 | Scrape Lamudi PH → ~200–300 Cebu listings                                          | Manual run                                |
| 2.18 | Verify: scraped records appear in admin review table                               | —                                         |

**Deliverable:** Data pipeline functional. ~300–500 properties scraped, enriched, and approved for training.

---

## Day 3 — AVM Engine

**Goal:** ML model trained. Sidecar serves inferences. Valuation endpoint works.

| #    | Task                                                                                | Detail                              |
| ---- | ----------------------------------------------------------------------------------- | ----------------------------------- |
| 3.1  | Bump Python sidecar to 3.12 (`pyproject.toml`, `.python-version`)                   | [05-avm-engine](./05-avm-engine.md) |
| 3.2  | Implement feature engineering: extract features from approved records               | [05-avm-engine](./05-avm-engine.md) |
| 3.3  | Write `scripts/train.py` — XGBoost training with early stopping                     | [05-avm-engine](./05-avm-engine.md) |
| 3.4  | Train initial model on scraped data, compute MAPE                                   | —                                   |
| 3.5  | Implement formula-based heuristics for property types with <50 records              | [05-avm-engine](./05-avm-engine.md) |
| 3.6  | Implement FastAPI `/infer` endpoint (feature vector → estimate + CI)                | [05-avm-engine](./05-avm-engine.md) |
| 3.7  | Implement FastAPI `/model/info` endpoint                                            | [05-avm-engine](./05-avm-engine.md) |
| 3.8  | Implement FastAPI `/admin/retrain` endpoint                                         | [05-avm-engine](./05-avm-engine.md) |
| 3.9  | Implement FastAPI `/admin/load` hot-swap endpoint                                   | [05-avm-engine](./05-avm-engine.md) |
| 3.10 | Implement NestJS ValuationModule (assemble features, call sidecar, handle fallback) | [05-avm-engine](./05-avm-engine.md) |
| 3.11 | Implement `POST /valuation` and `GET /valuation/:id` endpoints                      | [06-api-design](./06-api-design.md) |
| 3.12 | Implement confidence scoring heuristic                                              | [05-avm-engine](./05-avm-engine.md) |
| 3.13 | Implement heatmap tile endpoint (`GET /heatmap/tiles`)                              | [06-api-design](./06-api-design.md) |
| 3.14 | Implement quick pin estimate (`GET /heatmap/estimate`)                              | [06-api-design](./06-api-design.md) |
| 3.15 | Verify: `POST /valuation` returns reasonable estimates for Cebu properties          | —                                   |

**Deliverable:** AVM functional. API returns valuations with confidence bands.

---

## Day 4 — Area Intelligence + Admin Dashboard

**Goal:** Area intel works. Full admin dashboard UI. Xendit sandbox integrated.

| #    | Task                                                                  | Detail                                            |
| ---- | --------------------------------------------------------------------- | ------------------------------------------------- |
| 4.1  | Implement area key rounding (500m grid)                               | [08-area-intelligence](./08-area-intelligence.md) |
| 4.2  | Implement cache lookup flow (DB → fresh fetch → upsert)               | [08-area-intelligence](./08-area-intelligence.md) |
| 4.3  | Implement BrightData Discover for area news                           | [08-area-intelligence](./08-area-intelligence.md) |
| 4.4  | Implement Gemini Flash summarization with factuality guardrails       | [08-area-intelligence](./08-area-intelligence.md) |
| 4.5  | Implement `GET /area/intelligence` endpoint (JWT-gated)               | [08-area-intelligence](./08-area-intelligence.md) |
| 4.6  | Implement Xendit invoice creation + webhook handler                   | [03-auth](./03-auth.md)                           |
| 4.7  | Implement API key management endpoints (create, list, rotate, revoke) | [03-auth](./03-auth.md)                           |
| 4.8  | Build admin layout + sidebar nav                                      | [07-frontend](./07-frontend.md)                   |
| 4.9  | Build admin discover page                                             | [07-frontend](./07-frontend.md)                   |
| 4.10 | Build admin scrape page (queue list + live progress + review table)   | [07-frontend](./07-frontend.md)                   |
| 4.11 | Build admin train page (pool summary + trigger + version table)       | [07-frontend](./07-frontend.md)                   |
| 4.12 | Implement admin train endpoints (run, status, complete callback)      | [06-api-design](./06-api-design.md)               |
| 4.13 | Build admin deploy page (version table + Promote)                     | [07-frontend](./07-frontend.md)                   |
| 4.14 | Implement admin deploy endpoint (hot-swap sidecar)                    | [06-api-design](./06-api-design.md)               |
| 4.15 | Build API keys management page in user dashboard                      | [07-frontend](./07-frontend.md)                   |
| 4.16 | Build upgrade flow (Xendit button → payment → tier upgrade)           | [07-frontend](./07-frontend.md)                   |
| 4.17 | Verify: full admin workflow: discover → scrape → train → deploy       | —                                                 |

**Deliverable:** Admin dashboard functional. Area intelligence live. Xendit sandbox working.

---

## Day 5 — Frontend + Polish + Demo

**Goal:** Map views complete. Demo-ready. All disclaimers in place.

| #    | Task                                                                                 | Detail                              |
| ---- | ------------------------------------------------------------------------------------ | ----------------------------------- |
| 5.1  | Implement Google Maps JS API wrapper (`MapContainer`)                                | [07-frontend](./07-frontend.md)     |
| 5.2  | Implement three-view toggle (Heatmap / Listings / Valuation)                         | [07-frontend](./07-frontend.md)     |
| 5.3  | Implement heatmap view (GeoJSON tile layer + filter bar)                             | [07-frontend](./07-frontend.md)     |
| 5.4  | Implement listings view (pins + side panel with details)                             | [07-frontend](./07-frontend.md)     |
| 5.5  | Implement valuation view (pin drop → valuation call + panel)                         | [07-frontend](./07-frontend.md)     |
| 5.6  | Build `ValuationPanel` component (estimate, confidence band, comparables)            | [07-frontend](./07-frontend.md)     |
| 5.7  | Build `ConfidenceBadge` + `DataCompletenessMeter`                                    | [07-frontend](./07-frontend.md)     |
| 5.8  | Build `AreaIntelCard` (bullet points + source attribution)                           | [07-frontend](./07-frontend.md)     |
| 5.9  | Build login + signup pages                                                           | [07-frontend](./07-frontend.md)     |
| 5.10 | Build TanStack Query hooks (`useValuation`, `useHeatmap`, `useAreaIntel`, `useAuth`) | [07-frontend](./07-frontend.md)     |
| 5.11 | Implement auth interceptor (auto-refresh)                                            | [07-frontend](./07-frontend.md)     |
| 5.12 | Implement admin sandbox map preview                                                  | [07-frontend](./07-frontend.md)     |
| 5.13 | Implement PDF report generation + download                                           | [06-api-design](./06-api-design.md) |
| 5.14 | Add legal disclaimer to all valuation panels                                         | [07-frontend](./07-frontend.md)     |
| 5.15 | Add BIR compliance prototype flag                                                    | [09-bir-zonal](./09-bir-zonal.md)   |
| 5.16 | Execute demo script: admin scrapes Cebu, user gets valuation, area intel appears     | —                                   |
| 5.17 | Polish UI: loading states, error handling, empty states                              | —                                   |
| 5.18 | Verify: all three views work, auth flow works, admin pipeline works                  | —                                   |

**Deliverable:** Demo-ready application. All views functional. Admin pipeline complete.

---

## Dependency Graph

```
Phase 1 (Infra) ─────────────────────────────────────────────────────┐
      │                                                               │
      ├──► Phase 2 (Data Pipeline) ──► Phase 3 (AVM) ──┐              │
      │                                                 ├──► Phase 5 (Frontend)
      └──► Phase 4 (Area Intel + Admin) ────────────────┘              │
                                                                       │
Phase 2 can start alongside Phase 4 (different teams/streams)          │
Phase 5 requires Phase 3 + Phase 4 complete                            │
```

**Critical path:** Infra → Data Pipeline → AVM → Frontend (Days 1–3 sequential, Days 4–5 parallelizable).

---

## Risk Register

| Risk                                               | Impact                       | Mitigation                                                                       |
| -------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------- |
| BrightData scraper returns incomplete JSON         | Can't train model            | Fallback to manual data entry; cut down schema fields to absolute minimum        |
| Google Maps API quota exhausted                    | No geocoding for batch       | Prioritize geocoding most recent records; use city/barangay centroid as fallback |
| Gemini returns hallucinated facts                  | Misleading area intel        | Guardrails in prompt; always show source URLs; summarize-only constraint         |
| <200 approved records by Day 3                     | Undertrained model           | Formula heuristics as fallback; clearly communicate low confidence               |
| Xendit sandbox webhook not reachable               | Payment flow can't be tested | Use ngrok tunnel for local dev; test with Xendit sandbox simulator               |
| Python 3.12 incompatibility with existing packages | Sidecar won't start          | Pin dependency versions in pyproject.toml; test early on Day 1                   |
| Prisma migration conflicts with PostGIS            | DB setup fails               | Test `CREATE EXTENSION postgis` in a pre-migration hook                          |
