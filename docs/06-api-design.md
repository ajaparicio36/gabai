# 06 — API Design

## Overview

The NestJS API serves as the central backend. All endpoints follow a `{ data, error }` response envelope via a global interceptor.

---

## Response Envelope

Every endpoint returns:

```typescript
{
  data: T | null,
  error: { code: string; message: string; details?: any } | null
}
```

```typescript
// libs/shared-types/src/api-response.ts
export class ApiResponseDto<T> {
  data: T | null;
  error: ApiErrorDto | null;
}

export class ApiErrorDto {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
```

---

## Endpoint Catalog

### Public (no auth)

| Method | Path      | Description                            |
| ------ | --------- | -------------------------------------- |
| `GET`  | `/health` | Service health (DB, Redis, ML sidecar) |

### Auth (unauthenticated)

| Method | Path            | Body / Params         | Description                            |
| ------ | --------------- | --------------------- | -------------------------------------- |
| `POST` | `/auth/signup`  | `{ email, password }` | Register new user                      |
| `POST` | `/auth/login`   | `{ email, password }` | Login, returns access + refresh tokens |
| `POST` | `/auth/refresh` | `{ refreshToken }`    | Rotate refresh token, return new pair  |
| `POST` | `/auth/logout`  | `{ refreshToken }`    | Revoke refresh token                   |

### User (JWT required, free tier)

| Method   | Path                                             | Description                               |
| -------- | ------------------------------------------------ | ----------------------------------------- |
| `GET`    | `/auth/me`                                       | Current user profile                      |
| `GET`    | `/area/intelligence?lat=&lng=`                   | Area news bullets (registered users only) |
| `GET`    | `/heatmap/tiles?bbox=&propertyType=&priceRange=` | GeoJSON tiles for bounding box            |
| `GET`    | `/heatmap/estimate?lat=&lng=&propertyType=`      | Quick pin estimate                        |
| `GET`    | `/auth/api-keys`                                 | List user's API keys (prefix only)        |
| `POST`   | `/auth/api-keys`                                 | Generate new API key                      |
| `POST`   | `/auth/api-keys/:id/rotate`                      | Rotate API key                            |
| `DELETE` | `/auth/api-keys/:id`                             | Revoke API key                            |
| `POST`   | `/auth/payment/create-invoice`                   | Create Xendit invoice for upgrade         |
| `GET`    | `/auth/payment/status`                           | Check payment/tier status                 |

### Paid (API key required, paid tier)

| Method | Path               | Body / Params                                                                                     | Description                         |
| ------ | ------------------ | ------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `POST` | `/valuation`       | `{ lat, lng, propertyType, lotAreaSqm, floorAreaSqm?, bedrooms?, bathrooms?, buildingAgeYears? }` | Full valuation with confidence band |
| `GET`  | `/valuation/:id`   | —                                                                                                 | Retrieve stored valuation           |
| `POST` | `/report/generate` | `{ valuationId }`                                                                                 | Generate PDF appraisal report       |
| `GET`  | `/report/:id`      | —                                                                                                 | Download signed PDF URL             |

### Admin (JWT + Admin role)

| Method | Path                       | Body                                            | Description                                          |
| ------ | -------------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| `POST` | `/admin/discover`          | `{ location, propertyType, dateRange? }`        | Run BrightData Discover                              |
| `GET`  | `/admin/discover/targets`  | —                                               | List discovered URLs                                 |
| `POST` | `/admin/discover/approve`  | `{ ids }`                                       | Queue selected targets for scraping                  |
| `POST` | `/admin/scrape/run`        | —                                               | Dispatch scrape jobs for all queued targets          |
| `GET`  | `/admin/scrape/status`     | —                                               | Scrape progress                                      |
| `GET`  | `/admin/scrape/records`    | —                                               | List scraped records (with flags)                    |
| `POST` | `/admin/scrape/approve`    | `{ ids }`                                       | Approve records → enrichment queue                   |
| `POST` | `/admin/scrape/reject`     | `{ ids }`                                       | Reject records                                       |
| `POST` | `/admin/train/run`         | —                                               | Trigger training run (dispatches to sidecar)         |
| `GET`  | `/admin/train/status`      | —                                               | Current training job status                          |
| `POST` | `/admin/train/complete`    | `{ version, modelPath, mape, trainingRecords }` | Internal callback from sidecar                       |
| `GET`  | `/admin/train/versions`    | —                                               | List all model versions                              |
| `POST` | `/admin/deploy/:versionId` | —                                               | Promote model version to deployed (hot-swap sidecar) |
| `GET`  | `/admin/deploy/status`     | —                                               | Currently deployed model info                        |

### Webhooks (Xendit IP whitelist)

| Method | Path               | Description                                   |
| ------ | ------------------ | --------------------------------------------- |
| `POST` | `/payment/webhook` | Xendit payment notification (success/failure) |

---

## Guard Hierarchy

```
Route → ThrottlerGuard → JwtAuthGuard → AdminGuard (if admin)
                                    → ApiKeyGuard (if api key endpoint)
```

Applied via:

```typescript
// Public
@Controller('health')
export class HealthController { ... }

// Free / registered
@UseGuards(JwtAuthGuard)
@Controller('area')
export class AreaController { ... }

// Admin-only
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController { ... }

// Paid (API key)
@UseGuards(ApiKeyGuard)
@Throttle({ paid: { limit: 100, ttl: 60000 } })
@Controller('valuation')
export class ValuationController { ... }
```

---

## Rate Limiting Config

```typescript
ThrottlerModule.forRoot([
  { name: 'default', ttl: 60000, limit: 30 }, // Unauthenticated: 30 req/min
  { name: 'user', ttl: 60000, limit: 100 }, // Authenticated free: 100 req/min
  { name: 'paid', ttl: 60000, limit: 1000 }, // Paid API key: 1000 req/min
  { name: 'admin', ttl: 60000, limit: 300 }, // Admin: 300 req/min
]);
```

---

## DTO Conventions

All request DTOs use `class-validator` decorators. All response DTOs are plain classes.

```typescript
// apps/gabai/nest/src/modules/valuation/dto/valuation.dto.ts
import {
  IsNumber,
  IsString,
  IsOptional,
  Min,
  Max,
  IsIn,
} from 'class-validator';

export class ValuationRequestDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsString()
  @IsIn(['residential_lot', 'house_and_lot', 'condo', 'commercial'])
  propertyType!: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  lotAreaSqm?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  floorAreaSqm?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  bedrooms?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  bathrooms?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(200)
  buildingAgeYears?: number;
}

export class ValuationResponseDto {
  pointEstimatePhp!: number;
  confidenceLowPhp!: number;
  confidenceHighPhp!: number;
  confidenceScore!: number;
  dataCompleteness!: number;
  pricePerSqmPhp!: number;
  comparablesUsed!: ComparableDto[];
  proximityBreakdown!: Record<string, number>;
  birCompliance?: BirComplianceDto;
  modelVersion!: string;
}
```

---

## Error Handling

Domain errors use NestJS exceptions with structured codes:

```typescript
// libs/shared-types/src/errors.ts
export const ValuationError = {
  INSUFFICIENT_DATA: (missing: string[]) =>
    new BadRequestException({
      code: 'VALUATION.INSUFFICIENT_DATA',
      message: `Missing required fields: ${missing.join(', ')}`,
      details: { missing },
    }),

  NO_COMPARABLES: (propertyType: string) =>
    new NotFoundException({
      code: 'VALUATION.NO_COMPARABLES',
      message: `No comparable properties found for type: ${propertyType}`,
    }),

  ML_SIDECAR_DOWN: () =>
    new ServiceUnavailableException({
      code: 'VALUATION.ML_SIDECAR_DOWN',
      message: 'Valuation engine temporarily unavailable',
    }),
} as const;
```

---

## Swagger / OpenAPI

In development (`NODE_ENV !== 'production'`), Swagger UI is mounted at `GET /api/docs`. Decorators live in `swagger/` directories per feature, following the dreamsoft pattern of colocated decorators applied via `applyDecorators()`.
