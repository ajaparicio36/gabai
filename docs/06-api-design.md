# 06 — API Design

## Overview

The NestJS API serves as the central backend. All endpoints follow a `{ data, error }` response envelope enforced by a global interceptor and exception filter.

Base URL: `/api/v1`

> **Decision:** Valuation, heatmap, area-intelligence, and report endpoints are **internal-only** — called by our Next.js frontend (JWT-gated), not exposed as a public API. The paid-tier external API and Xendit payment flow are deferred `[D]` pending future discussion.

---

## Status Legend

| Marker | Meaning     |
| ------ | ----------- |
| `[ ]`  | Not started |
| `[~]`  | In progress |
| `[x]`  | Done        |
| `[D]`  | Deferred    |

---

## Global Bootstrap (`main.ts`)

The following is registered globally at app startup:

| Concern                 | Implementation                                      | Status |
| ----------------------- | --------------------------------------------------- | ------ |
| `ValidationPipe`        | `whitelist`, `forbidNonWhitelisted`, `transform`    | `[x]`  |
| `GlobalExceptionFilter` | Catches all exceptions → `{ data: null, error }`    | `[x]`  |
| `ResponseInterceptor`   | Wraps controller returns → `{ data, error: null }`  | `[x]`  |
| CORS                    | Origin: `http://localhost:4200`, credentials: true  | `[x]`  |
| URI Versioning          | `VersioningType.URI`, default v1                    | `[x]`  |
| API Documentation       | Scalar API Reference at `/v1/docs` (not Swagger UI) | `[x]`  |
| Global prefix           | `api/v1`                                            | `[x]`  |

---

## Response Envelope

Every endpoint returns:

```typescript
{
  data: T | null,
  error: { code: string; message: string; details?: Record<string, unknown> } | null
}
```

### Source location

The shared DTOs and error codes live in `@gabai/platform` (`libs/platform/`), **not** a separate `shared-types` lib:

```typescript
// libs/platform/src/lib/api-response.dto.ts
export class ApiErrorDto {
  code!: string; // Machine-readable (e.g. 'AUTH.INVALID_CREDENTIALS')
  message!: string; // Human-readable message
  details?: Record<string, unknown>; // Optional structured details
}

export class ApiResponseDto<T> {
  data!: T | null;
  error!: ApiErrorDto | null;
}
```

### How it works

- **Success path:** The `ResponseInterceptor` wraps the controller's return value in `{ data: <value>, error: null }`.
- **Error path:** The `GlobalExceptionFilter` catches every exception (HttpException and unhandled) and returns `{ data: null, error: { code, message, details? } }`.
- **Pass-through:** If a controller manually returns a `{ data, error }` shape, the interceptor detects it and passes it through without double-wrapping.

### On the frontend

The Axios interceptor is aware of the envelope — it accesses `response.data.data.accessToken` when handling the refresh flow.

---

## Endpoint Catalog

### Auth (unauthenticated) — all built

| Status | Method | Path            | Body / Params         | Description                            |
| ------ | ------ | --------------- | --------------------- | -------------------------------------- |
| `[x]`  | `POST` | `/auth/signup`  | `{ email, password }` | Register new user                      |
| `[x]`  | `POST` | `/auth/login`   | `{ email, password }` | Login, returns access + refresh tokens |
| `[x]`  | `POST` | `/auth/refresh` | `{ refreshToken }`    | Rotate refresh token, return new pair  |
| `[x]`  | `POST` | `/auth/logout`  | `{ refreshToken }`    | Revoke refresh token                   |

### User (JWT required) — partially built

| Status | Method   | Path                           | Description                               |
| ------ | -------- | ------------------------------ | ----------------------------------------- |
| `[x]`  | `GET`    | `/auth/me`                     | Current user profile                      |
| `[x]`  | `POST`   | `/auth/api-keys`               | Generate new API key (`gabai_sk_<32hex>`) |
| `[x]`  | `GET`    | `/auth/api-keys`               | List user's API keys (prefix only)        |
| `[x]`  | `POST`   | `/auth/api-keys/:id/rotate`    | Rotate API key (returns new raw key)      |
| `[x]`  | `DELETE` | `/auth/api-keys/:id`           | Revoke API key                            |
| `[ ]`  | `GET`    | `/area/intelligence?lat=&lng=` | Area news bullets (registered users only) |
| `[ ]`  | `GET`    | `/heatmap/tiles?bbox=&type=`   | GeoJSON tiles for bounding box            |
| `[ ]`  | `GET`    | `/heatmap/estimate?lat=&lng=`  | Quick pin estimate                        |
| `[ ]`  | `POST`   | `/auth/payment/create-invoice` | Create Xendit invoice for upgrade         |
| `[ ]`  | `GET`    | `/auth/payment/status`         | Check payment/tier status                 |

### Internal (frontend-only, JWT-gated) — not started

> These endpoints are called exclusively by the Next.js frontend. They are **not exposed as a public API** and are guarded by `JwtAuthGuard`.

| Status | Method | Path                           | Description                               |
| ------ | ------ | ------------------------------ | ----------------------------------------- |
| `[ ]`  | `POST` | `/valuation`                   | Full valuation with confidence band       |
| `[ ]`  | `GET`  | `/valuation/:id`               | Retrieve stored valuation                 |
| `[ ]`  | `GET`  | `/heatmap/tiles?bbox=&type=`   | GeoJSON tiles for bounding box            |
| `[ ]`  | `GET`  | `/heatmap/estimate?lat=&lng=`  | Quick pin estimate                        |
| `[ ]`  | `GET`  | `/area/intelligence?lat=&lng=` | Area news bullets (registered users only) |
| `[ ]`  | `POST` | `/report/generate`             | Generate PDF appraisal report             |
| `[ ]`  | `GET`  | `/report/:id`                  | Download signed PDF URL                   |

### Paid (API key required) — deferred

> Deferred `[D]` — no external API is exposed yet. The `ApiKeyGuard` is built and ready but no endpoints use it.

| Status | Path                      | Description                                          |
| ------ | ------------------------- | ---------------------------------------------------- |
| `[D]`  | `/valuation`, `/report/*` | Would be API-key-gated if/when exposed as public API |

### Admin (JWT + Admin role) — not started

| Status | Method | Path                       | Description                        |
| ------ | ------ | -------------------------- | ---------------------------------- |
| `[ ]`  | `POST` | `/admin/discover`          | Run BrightData Discover            |
| `[ ]`  | `GET`  | `/admin/discover/targets`  | List discovered URLs               |
| `[ ]`  | `POST` | `/admin/discover/approve`  | Queue selected for scraping        |
| `[ ]`  | `POST` | `/admin/scrape/run`        | Dispatch scrape jobs               |
| `[ ]`  | `GET`  | `/admin/scrape/status`     | Scrape progress                    |
| `[ ]`  | `GET`  | `/admin/scrape/records`    | List scraped records               |
| `[ ]`  | `POST` | `/admin/scrape/approve`    | Approve records → enrichment       |
| `[ ]`  | `POST` | `/admin/scrape/reject`     | Reject records                     |
| `[ ]`  | `POST` | `/admin/train/run`         | Trigger training run               |
| `[ ]`  | `GET`  | `/admin/train/status`      | Training job status                |
| `[ ]`  | `POST` | `/admin/train/complete`    | Internal callback from sidecar     |
| `[ ]`  | `GET`  | `/admin/train/versions`    | List model versions                |
| `[ ]`  | `POST` | `/admin/deploy/:versionId` | Promote version → hot-swap sidecar |
| `[ ]`  | `GET`  | `/admin/deploy/status`     | Currently deployed model info      |

### Webhooks (Xendit IP whitelist) — deferred

> Deferred `[D]` — payment flow blocked on the external API decision.

| Status | Method | Path               | Description                                   |
| ------ | ------ | ------------------ | --------------------------------------------- |
| `[D]`  | `POST` | `/payment/webhook` | Xendit payment notification (success/failure) |

---

## Guard Hierarchy

### Current state

No rate limiting layer is implemented yet (`ThrottlerGuard` / `ThrottlerModule` not wired).

```
Route → JwtAuthGuard → AdminGuard (if admin)
```

- **Internal endpoints** (`/valuation`, `/heatmap`, `/area`, `/report`): guarded by `JwtAuthGuard` — called only by our Next.js frontend.
- **`ApiKeyGuard`** is built but **unused** — no endpoints require it since there is no public API yet. It exists ready for if/when we expose `/valuation` externally.

### How guards work

- **`JwtAuthGuard`** (custom, no Passport): Extracts `Bearer <token>` from Authorization header, verifies with `JwtService.verify<T>()`, attaches payload to `request.user`. Throws `AUTH.UNAUTHORIZED` or `AUTH.TOKEN_EXPIRED`.
- **`AdminGuard`** (custom): Checks `request.user.role === 'admin'`. Expects `JwtAuthGuard` to have run first. Throws `AUTH.FORBIDDEN`.
- **`ApiKeyGuard`** (custom, deferred): Checks `X-API-Key` header first, falls back to `Authorization: Bearer gabai_sk_...`. Looks up key hash in DB. Checks `revokedAt`. Attaches `request.apiKey` with the DB record. Throws `AUTH.API_KEY_INVALID` / `AUTH.API_KEY_REVOKED`.

**(Note: `ApiKeyGuard` currently doesn't hash the incoming key before DB lookup — needs fixing.)**

### Usage pattern

```typescript
// Unauthenticated
@Controller('auth')
export class AuthController { ... }

// JWT required (all internal endpoints)
@UseGuards(JwtAuthGuard)
@Controller('valuation')
export class ValuationController { ... }

// JWT required (registered users)
@UseGuards(JwtAuthGuard)
@Controller('area')
export class AreaController { ... }

// Admin
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController { ... }

// Public API (deferred)
// @UseGuards(ApiKeyGuard)
// @Controller('valuation')
// export class ExternalValuationController { ... }
```

---

## Rate Limiting Config

**Planned — not implemented.** The modules and config exist in the plan but no `ThrottlerModule` is wired in `AppModule`:

```typescript
// Planned:
ThrottlerModule.forRoot([
  { name: 'default', ttl: 60000, limit: 30 },
  { name: 'user', ttl: 60000, limit: 100 },
  { name: 'paid', ttl: 60000, limit: 1000 },
  { name: 'admin', ttl: 60000, limit: 300 },
]);
```

---

## DTO Conventions

### Current state

- All DTOs use `class-validator` decorators (`@IsEmail`, `@IsString`, `@MinLength`, etc.).
- DTOs live **in the NestJS app module** where they are used (`apps/gabai/nest/src/modules/<feature>/dto/`).
- The `@gabai/shared-types` library does **not exist yet**. There are no Zod schemas in the codebase.
- Auth DTOs built: `SignupDto`, `SignupResponseDto`, `LoginDto`, `LoginResponseDto`, `RefreshDto`

### Pattern

```typescript
// apps/gabai/nest/src/modules/auth/dto/signup.dto.ts
export class SignupDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class SignupResponseDto {
  id!: string;
  email!: string;
}
```

### Planned DTOs (valuation example)

```typescript
// Planned location: apps/gabai/nest/src/modules/valuation/dto/
export class ValuationRequestDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;
  // ... full schema in Phase 4
}
```

---

## Error Handling

### Current implementation

Errors use NestJS exceptions with structured codes. The codes are defined in `libs/platform/src/lib/error-codes.constants.ts` as a nested constants object:

```typescript
// libs/platform/src/lib/error-codes.constants.ts
export const ERROR_CODES = {
  VALIDATION: {
    INVALID_INPUT: 'VALIDATION.INVALID_INPUT',
    MISSING_FIELD: 'VALIDATION.MISSING_FIELD',
    INVALID_FORMAT: 'VALIDATION.INVALID_FORMAT',
  },
  AUTH: {
    INVALID_CREDENTIALS: 'AUTH.INVALID_CREDENTIALS',
    TOKEN_EXPIRED: 'AUTH.TOKEN_EXPIRED',
    TOKEN_REVOKED: 'AUTH.TOKEN_REVOKED',
    TOKEN_REUSE_DETECTED: 'AUTH.TOKEN_REUSE_DETECTED',
    EMAIL_TAKEN: 'AUTH.EMAIL_TAKEN',
    UNAUTHORIZED: 'AUTH.UNAUTHORIZED',
    FORBIDDEN: 'AUTH.FORBIDDEN',
    API_KEY_INVALID: 'AUTH.API_KEY_INVALID',
    API_KEY_EXPIRED: 'AUTH.API_KEY_EXPIRED',
    API_KEY_REVOKED: 'AUTH.API_KEY_REVOKED',
    // ...
  },
  VALUATION: {
    INSUFFICIENT_DATA: 'VALUATION.INSUFFICIENT_DATA',
    NO_COMPARABLES: 'VALUATION.NO_COMPARABLES',
    ML_SIDECAR_DOWN: 'VALUATION.ML_SIDECAR_DOWN',
    // ...
  },
  NOT_FOUND: { USER: 'NOT_FOUND.USER', ROUTE: 'NOT_FOUND.ROUTE' /* ... */ },
  RATE_LIMIT: { EXCEEDED: 'RATE_LIMIT.EXCEEDED' },
  INTERNAL: {
    UNKNOWN: 'INTERNAL.UNKNOWN',
    DATABASE: 'INTERNAL.DATABASE',
    EXTERNAL_SERVICE: 'INTERNAL.EXTERNAL_SERVICE',
  },
  PIPELINE: { SCRAPE_FAILED: 'PIPELINE.SCRAPE_FAILED' /* ... */ },
  PAYMENT: { INVOICE_FAILED: 'PAYMENT.INVOICE_FAILED' /* ... */ },
  REPORT: { GENERATION_FAILED: 'REPORT.GENERATION_FAILED' },
} as const;
```

The `GlobalExceptionFilter` uses `ERROR_CODES` to derive standardized codes from HTTP status codes.

### Usage in services

```typescript
throw new BadRequestException({
  code: ERROR_CODES.VALUATION.INSUFFICIENT_DATA,
  message: `Missing required fields: ${missing.join(', ')}`,
  details: { missing },
});

throw new UnauthorizedException({
  code: ERROR_CODES.AUTH.INVALID_CREDENTIALS,
  message: 'Invalid email or password',
});
```

### How the filter processes exceptions

1. If the thrown `HttpException` response already has a `code` field → uses it directly, passes through `message` and `details`.
2. If no `code` → derives one from HTTP status (400 → `VALIDATION.INVALID_INPUT`, 401 → `AUTH.UNAUTHORIZED`, 403 → `AUTH.FORBIDDEN`, 404 → `NOT_FOUND.ROUTE`, 429 → `RATE_LIMIT.EXCEEDED`).
3. Unhandled (non-HttpException) → logs stack trace, returns `INTERNAL.UNKNOWN` with generic message.

---

## API Documentation

- **Scalar API Reference** (not Swagger UI) at `GET /v1/docs`
- Built with `@scalar/nestjs-api-reference`
- Theme: `purple`
- Auth schemes registered: Bearer (JWT) + API key (`X-API-Key` header)
- Swagger decorators colocated per-feature via `auth.openapi.ts` helper class

---

## Module Map (actual vs planned)

Only the following NestJS modules exist:

```
apps/gabai/nest/src/
├── main.ts
├── common/
│   ├── filters/global-exception.filter.ts    ← [x]
│   └── interceptors/response.interceptor.ts  ← [x]
├── config/
│   └── env.validation.ts                     ← [x]
├── app/
│   ├── app.module.ts                         ← [x]
│   ├── app.controller.ts                     ← [x]
│   └── app.service.ts                        ← [x]
└── modules/
    └── auth/                                 ← [x]
        ├── auth.module.ts
        ├── auth.controller.ts
        ├── auth.service.ts
        ├── auth.repository.ts
        ├── auth.openapi.ts
        ├── dto/
        │   ├── login.dto.ts
        │   ├── signup.dto.ts
        │   └── refresh.dto.ts
        ├── guards/
        │   ├── jwt.guard.ts
        │   ├── api-key.guard.ts
        │   └── admin.guard.ts
        └── types/
            └── auth.types.ts
```

Planned but not built: `pipeline`, `valuation`, `heatmap`, `area`, `report`, `admin`, `payment` modules.
