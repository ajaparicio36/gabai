# Agent Instructions — GABAI

This is the authoritative reference for all AI agents working in this repository. Read this before taking any action.

---

## Project Identity

**GABAI** is an AI-powered Automated Valuation Model (AVM) for Philippine real estate. It scrapes property listings, enriches them with government and location data, trains an XGBoost regression model, and provides instant property valuations with confidence bands.

- **Target market:** Metro Cebu (hackathon), expandable to national coverage
- **Tech stack:** NestJS + Next.js 16 + Python 3.12 FastAPI + PostgreSQL/PostGIS + Redis + Prisma
- **Docs:** `docs/INDEX.md` is the master implementation tracker; detail docs in `docs/*.md`

---

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

---

## Commands

```bash
# Build / type-check / lint / test all projects
pnpm nx build @gabai/nest @gabai/web
pnpm nx typecheck @gabai/nest @gabai/web
pnpm nx lint @gabai/nest @gabai/web
pnpm nx test @gabai/nest @gabai/web

# Single project
pnpm nx build @gabai/nest
pnpm nx test @gabai/nest --testFile=src/modules/auth/auth.service.spec.ts

# Dev servers
pnpm nx serve @gabai/nest      # NestJS → http://localhost:3000/api
pnpm nx dev @gabai/web          # Next.js → http://localhost:4200
pnpm nx serve @gabai/sidecar    # Python ML → http://localhost:8000

# Prisma
pnpm nx run @gabai/platform:prisma-migrate   # Run migrations
pnpm nx run @gabai/platform:prisma-seed      # Seed database (creates admin user)
pnpm nx run @gabai/platform:prisma-studio    # Prisma Studio UI

# Format
pnpm prettier --write .
pnpm prettier --check .
```

---

## Monorepo Layout

```
apps/gabai/
  nest/           — NestJS v11 API server (HTTP + BullMQ workers)
  web/            — Next.js 16 frontend (App Router, Tailwind)
  sidecar/        — Python 3.12 FastAPI ML inference service
libs/
  platform/       — Prisma client, schema, migrations, DB service, spatial helpers
  shared-types/   — TypeScript types, Zod schemas, shared DTOs, error codes
  pipeline/       — Scraping strategies, enrichment logic, geocoding services
docs/             — Implementation plans and architecture docs (see docs/INDEX.md)
scripts/          — Standalone scripts (train.py, bir_zonal_pipeline.py)
models/           — Trained XGBoost model files (*.pkl)
```

**Package naming:** `@gabai/<name>` (e.g., `@gabai/platform`, `@gabai/shared-types`).

---

## Architectural Decisions

Key decisions are documented in the [decisions log](./docs/01-architecture.md). Critical ones:

| Decision        | Rule                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------- |
| Spatial queries | PostGIS via `Unsupported` type + Prisma `$queryRaw` — never application-level Haversine           |
| Currency        | Floats (not integers/centavos) — PHP property values are millions                                 |
| Primary model   | Single XGBoost with property type one-hot encoded — not per-type models                           |
| Cold start      | Formula heuristics for property types with <50 training records                                   |
| C_rep inference | Neighborhood median + developer brand tier — NOT property's own asking price                      |
| Gemini          | Summarize-only with source attribution — never synthesize or speculate                            |
| Refresh tokens  | Opaque, SHA-256 hashed, DB-tracked, rotated on each refresh — theft-detection via reuse detection |

---

## NestJS Patterns

### Module structure

```
apps/gabai/nest/src/modules/<feature>/
  <feature>.module.ts
  <feature>.controller.ts        # HTTP concerns only — delegates to service
  <feature>.service.ts           # Business logic — injects repository, not DB directly
  <feature>.repository.ts        # Data access only — all DB calls live here
  <feature>.spec.ts
  dto/                           # Request/response shapes (class-validator)
  guards/                        # Feature-specific guards
  types/                         # TypeScript types scoped to this feature
```

### Controllers → Services → Repositories

- **Controllers:** HTTP concerns only (routing, DTO parsing, response shaping). No business logic.
- **Services:** Domain logic. Inject the feature's repository (not DB directly). Throw NestJS exceptions. Unaware of HTTP.
- **Repositories:** Data access layer. All DB calls live here. Inject `PrismaService`. No business logic.

```typescript
@Injectable()
export class ValuationRepository {
  constructor(private readonly prisma: PrismaService) {}
  async findById(id: string) {
    return this.prisma.valuation.findUnique({ where: { id } });
  }
}

@Injectable()
export class ValuationService {
  constructor(private readonly valuationRepository: ValuationRepository) {}
  async getValuation(id: string) {
    return this.valuationRepository.findById(id);
  }
}
```

### Dependency injection

Constructor injection only. Inject by class token. Never use property injection.

### Guards

Apply in order: rate limit → auth → role → ownership.

```typescript
// Public (no auth)
@Controller('health')

// Registered user (JWT)
@UseGuards(JwtAuthGuard)
@Controller('area')

// Admin (JWT + role)
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')

// Paid (API key)
@UseGuards(ApiKeyGuard)
@Controller('valuation')
```

### Response envelope

Every HTTP response follows `{ data: T | null, error: ApiErrorDto | null }`. Use a global interceptor to wrap returns.

### Error handling

Use typed domain errors with structured codes:

```typescript
throw new BadRequestException({
  code: 'VALUATION.INSUFFICIENT_DATA',
  message: 'Missing required fields: lotAreaSqm, floorAreaSqm',
});
```

No generic `Error` throws. No swallowing exceptions without rethrow or logging.

---

## Prisma & Database

### ORM: Prisma (not MikroORM)

- Schema: `libs/platform/prisma/schema.prisma`
- Client: generated into `libs/platform/src/generated/`
- Service: `libs/platform/src/prisma.service.ts` (injectable)
- Migrations: `libs/platform/prisma/migrations/`

### PostGIS

- Extension must be enabled: `CREATE EXTENSION IF NOT EXISTS postgis;` in first migration
- Spatial queries use `$queryRaw` with `ST_DWithin`, `ST_Distance`, `ST_SetSRID`, `ST_MakePoint`
- Spatial index on Property (lat, lng) via GiST
- No Prisma-native spatial types — use Float columns for lat/lng

### Migration workflow

```bash
pnpm nx run @gabai/platform:prisma-migrate -- --name <description>
```

Migrations adding PostGIS features must manually add spatial statements in `up()`.

### Currency

PHP amounts are stored as `Float` (double precision). Not integers/centavos. This is intentional — property values are in millions; sub-centavo precision is irrelevant.

---

## Auth System

### User model

- Email + password (bcrypt, 12 rounds)
- Roles: `user`, `admin`
- Tiers: `free`, `paid`

### Tokens

- **Access:** JWT (HS256), 15min expiry, in-memory only on client
- **Refresh:** Opaque (crypto.randomBytes), SHA-256 hashed in DB, 7d expiry, rotated on use
- **API keys:** `gabai_sk_<32 hex>`, SHA-256 hashed in DB, returned once at creation/rotation

### Refresh token rotation + theft detection

- `/auth/refresh` revokes the old token and issues a new pair
- If a revoked token is presented → all user tokens are revoked (theft detection)

### Rate limiting

NestJS `ThrottlerModule` with per-tier limits:

- `default`: 30 req/min (unauthenticated)
- `user`: 100 req/min (registered free)
- `paid`: 1000 req/min (API key)
- `admin`: 300 req/min

### Admin seeding

`libs/platform/prisma/seed.ts` creates one admin user. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars for deterministic seeding.

---

## TypeScript Strictness

`tsconfig.base.json` enables:

- `strict: true`
- `noUnusedLocals: true`
- `noImplicitReturns: true`
- `noFallthroughCasesInSwitch: true`

Additional rules:

- Never use `any` — use `unknown` + type guards
- Explicit return types on all exported functions
- `const` over `let` unless mutation is required
- No unused locals/params — remove dead code, don't suppress lint

---

## Engineering Standards

### Pre-implementation checklist

Before writing code, validate:

- Multi-table write? → transaction
- External side effect (email, BrightData, Xendit)? → queue/defer, define retry behavior
- Query in a loop? → batch or `Promise.all`
- Independent awaits? → `Promise.all`
- Retry possible? → idempotency (idempotency key or unique business key)
- Typed error path? → no stringly-typed failures
- Function doing too much? → split

### Query and async performance

- Never place DB/network queries inside loops when batching is possible
- Run independent async calls in parallel (`Promise.all`)
- Select only required fields — avoid over-fetching
- Avoid unbounded reads — use cursor/limit pagination for list APIs

### Multi-phase write safety

- Any multi-table write must be wrapped in a Prisma transaction
- For DB + external side effects (BrightData, Xendit): commit DB state first, then queue side effects
- Do not rely on rollback of external systems — use retryable jobs and compensation

---

## Environment Variables

See `.env.example`. Critical vars:

| Var                           | Required | Purpose                              |
| ----------------------------- | -------- | ------------------------------------ |
| `DATABASE_URL`                | Yes      | PostgreSQL connection string         |
| `REDIS_URL`                   | Yes      | Redis connection string              |
| `ML_SIDECAR_URL`              | Yes      | Python sidecar URL                   |
| `JWT_SECRET`                  | Yes      | HS256 signing key (min 32 chars)     |
| `GOOGLE_MAPS_KEY`             | Yes      | Geocoding + Places + Distance Matrix |
| `BRIGHTDATA_API_KEY`          | Yes      | Web scraping                         |
| `GEMINI_API_KEY`              | Yes      | Area news summarization              |
| `XENDIT_SECRET_KEY`           | Sandbox  | Payment processing                   |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Yes      | Frontend Google Maps JS              |
| `ADMIN_EMAIL`                 | No       | Admin seed email                     |
| `ADMIN_PASSWORD`              | No       | Admin seed password                  |

---

## Git Hooks (husky)

- `pre-commit` → `lint-staged` (prettier + eslint on staged `.ts/.tsx`; ruff on `.py`)
- `commit-msg` → `commitlint` (Conventional Commits: `feat`, `fix`, `chore`, `docs`, etc.)
- `pre-push` → full format check + lint + test + build
