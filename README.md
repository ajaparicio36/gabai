# GABAI

AI-powered Automated Valuation Model for Philippine real estate.

GABAI scrapes property listings, enriches them with government and location data, trains an XGBoost regression model, and provides instant property valuations with confidence bands via a Google Maps interface.

**Current scope:** Hackathon demo — Metro Cebu.  
**Tech stack:** NestJS 11 · Next.js 16 · Python 3.12 FastAPI · PostgreSQL/PostGIS · Redis · Prisma · XGBoost · BrightData · Gemini · Xendit

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your API keys and credentials

# Start infrastructure (PostgreSQL + Redis)
docker compose up -d db redis

# Run migrations and seed
pnpm nx run @gabai/platform:prisma-migrate
pnpm nx run @gabai/platform:prisma-seed

# Start services
pnpm nx serve @gabai/nest      # API → http://localhost:3000/api
pnpm nx dev @gabai/web          # Web → http://localhost:4200
pnpm nx serve @gabai/sidecar    # ML  → http://localhost:8000
```

## Full Docker

```bash
docker compose up -d
```

---

## Project Structure

```
apps/gabai/
  nest/           — NestJS API server (HTTP + BullMQ workers)
  web/            — Next.js 16 frontend (App Router, Tailwind)
  sidecar/        — Python 3.12 FastAPI ML inference
libs/
  platform/       — Prisma client, schema, migrations
  shared-types/   — TypeScript types, Zod schemas, DTOs
  pipeline/       — Scraping, enrichment, geocoding
docs/             — Architecture docs and build plans
scripts/          — Standalone scripts (training, BIR pipeline)
models/           — Trained XGBoost models
```

---

## Documentation

See `docs/INDEX.md` for the full implementation tracker. Key docs:

| Doc                                               | Contents                                   |
| ------------------------------------------------- | ------------------------------------------ |
| [01-architecture.md](./docs/01-architecture.md)   | System overview, decisions log, tech stack |
| [02-database.md](./docs/02-database.md)           | Prisma schema, PostGIS, spatial queries    |
| [03-auth.md](./docs/03-auth.md)                   | JWT auth, API keys, Xendit                 |
| [04-data-pipeline.md](./docs/04-data-pipeline.md) | BrightData scrape, geocoding, enrichment   |
| [05-avm-engine.md](./docs/05-avm-engine.md)       | XGBoost model, FastAPI sidecar             |
| [06-api-design.md](./docs/06-api-design.md)       | NestJS endpoints, guards, rate limiting    |
| [07-frontend.md](./docs/07-frontend.md)           | Map views, admin dashboard                 |
| [11-build-plan.md](./docs/11-build-plan.md)       | 5-day build schedule                       |

---

## Commands

```bash
pnpm nx build @gabai/nest           # Build NestJS
pnpm nx build @gabai/web            # Build Next.js
pnpm nx test @gabai/nest            # Run NestJS tests
pnpm nx test @gabai/web             # Run Next.js tests
pnpm nx lint @gabai/nest            # Lint NestJS
pnpm nx typecheck @gabai/nest       # Type-check NestJS
pnpm nx run @gabai/platform:prisma-studio  # Prisma Studio
```

---

## License

MIT
