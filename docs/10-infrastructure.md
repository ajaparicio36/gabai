# 10 — Infrastructure

## Overview

GABAI runs on Docker Compose for deployment and CI, but supports local development without Docker. The stack includes PostgreSQL + PostGIS, Redis for BullMQ and caching, and per-project Dockerfiles for each service.

---

## Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: apps/gabai/nest/Dockerfile
    ports:
      - '3000:3000'
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/gabai
      - REDIS_URL=redis://redis:6379
      - ML_SIDECAR_URL=http://ml:8000
      - GOOGLE_MAPS_KEY=${GOOGLE_MAPS_KEY}
      - BRIGHTDATA_API_KEY=${BRIGHTDATA_API_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
      - XENDIT_SECRET_KEY=${XENDIT_SECRET_KEY}
      - XENDIT_WEBHOOK_TOKEN=${XENDIT_WEBHOOK_TOKEN}
      - WEB_URL=${WEB_URL:-http://localhost:4200}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
      ml:
        condition: service_started

  ml:
    build:
      context: .
      dockerfile: apps/gabai/sidecar/Dockerfile
    ports:
      - '8000:8000'
    volumes:
      - ./models:/app/models
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/gabai
      - NESTJS_INTERNAL_URL=http://api:3000

  web:
    build:
      context: .
      dockerfile: apps/gabai/web/Dockerfile
    ports:
      - '4200:4200'
    environment:
      - NEXT_PUBLIC_GOOGLE_MAPS_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_KEY}
      - API_URL=http://api:3000

  db:
    image: postgis/postgis:16-3.4
    ports:
      - '5432:5432'
    environment:
      POSTGRES_DB: gabai
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redisdata:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
  redisdata:
```

---

## Per-Project Dockerfiles

### NestJS API (`apps/gabai/nest/Dockerfile`)

```dockerfile
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS builder
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json tsconfig.base.json tsconfig.json nx.json ./
COPY apps/gabai/nest/package.json apps/gabai/nest/
COPY libs/ libs/
RUN pnpm install --frozen-lockfile
COPY apps/gabai/nest/ apps/gabai/nest/
RUN pnpm nx build @gabai/nest

FROM base AS runner
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist/apps/gabai/nest ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### Next.js Web (`apps/gabai/web/Dockerfile`)

```dockerfile
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS builder
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json tsconfig.base.json tsconfig.json nx.json ./
COPY apps/gabai/web/package.json apps/gabai/web/
COPY libs/ libs/
RUN pnpm install --frozen-lockfile
COPY apps/gabai/web/ apps/gabai/web/
ARG NEXT_PUBLIC_GOOGLE_MAPS_KEY
ENV NEXT_PUBLIC_GOOGLE_MAPS_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_KEY
RUN pnpm nx build @gabai/web

FROM base AS runner
COPY --from=builder /app/apps/gabai/web/.next ./.next
COPY --from=builder /app/apps/gabai/web/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/gabai/web/package.json ./
EXPOSE 4200
CMD ["pnpm", "start"]
```

### Python ML Sidecar (`apps/gabai/sidecar/Dockerfile`)

```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir uv
COPY apps/gabai/sidecar/pyproject.toml apps/gabai/sidecar/.python-version ./
RUN uv sync --frozen

COPY apps/gabai/sidecar/src/ ./src/
COPY models/ ./models/

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "src.sidecar.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Local Development (Without Docker)

### Prerequisites

- Node.js 22
- pnpm (via corepack)
- Python 3.12 + uv
- PostgreSQL 16 with PostGIS extension
- Redis 7

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your local values

# 3. Start PostgreSQL + Redis (via your local package manager or docker for just these two)
# Option A: Docker for DB + Redis only
docker compose up -d db redis

# Option B: Local installs
# PostgreSQL: ensure PostGIS is available
# Redis: redis-server

# 4. Run migrations
pnpm nx run @gabai/platform:prisma-migrate

# 5. Seed the database
pnpm nx run @gabai/platform:prisma-seed

# 6. Start services
pnpm nx serve @gabai/nest     # NestJS API → http://localhost:3000/api
pnpm nx dev @gabai/web         # Next.js → http://localhost:4200
pnpm nx serve @gabai/sidecar   # Python ML → http://localhost:8000
```

### Commands

```bash
pnpm nx build @gabai/nest       # Build NestJS
pnpm nx build @gabai/web        # Build Next.js
pnpm nx test @gabai/nest        # Run NestJS tests
pnpm nx test @gabai/web         # Run Next.js tests
pnpm nx lint @gabai/nest        # Lint NestJS
pnpm nx lint @gabai/web         # Lint Next.js
pnpm nx typecheck @gabai/nest   # Type-check NestJS
pnpm nx typecheck @gabai/web    # Type-check Next.js
```

---

## BullMQ Queues

Three queues, all backed by Redis:

| Queue           | Purpose                                     | Concurrency | Retention |
| --------------- | ------------------------------------------- | ----------- | --------- |
| `scraping`      | Individual URL scrape jobs via BrightData   | 5           | 24h       |
| `enrichment`    | Geocoding + proximity per approved property | 10          | 24h       |
| `heatmap-regen` | Scheduled tile regeneration                 | 1           | 7d        |

```typescript
// apps/gabai/nest/src/modules/pipeline/pipeline.module.ts
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'scraping' },
      { name: 'enrichment' },
      { name: 'heatmap-regen' },
    ),
  ],
})
export class PipelineModule {}
```

---

## Environment Variables

```bash
# .env.example

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gabai

# Redis
REDIS_URL=redis://localhost:6379

# ML Sidecar
ML_SIDECAR_URL=http://localhost:8000

# API
PORT=3000
NODE_ENV=development

# Auth
JWT_SECRET=change-me-minimum-32-chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Admin Seed
ADMIN_EMAIL=admin@gabai.dev
ADMIN_PASSWORD=change-me

# Google Maps
GOOGLE_MAPS_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_KEY=

# BrightData
BRIGHTDATA_API_KEY=

# Gemini
GEMINI_API_KEY=

# Xendit (sandbox)
XENDIT_SECRET_KEY=
XENDIT_WEBHOOK_TOKEN=

# Web
WEB_URL=http://localhost:4200
```

---

## CI Pipeline

Located at `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis:16-3.4
        env:
          POSTGRES_DB: gabai
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: corepack enable && pnpm install --frozen-lockfile
      - run: pnpm nx format:check
      - run: pnpm nx lint @gabai/nest @gabai/web
      - run: pnpm nx typecheck @gabai/nest @gabai/web
      - run: pnpm nx build @gabai/nest @gabai/web
      - run: pnpm nx test @gabai/nest @gabai/web
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/gabai
          REDIS_URL: redis://localhost:6379
```
