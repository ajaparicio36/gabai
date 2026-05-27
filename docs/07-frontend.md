# 07 — Frontend

## Overview

Next.js 16 (App Router) with Tailwind CSS. The client uses Axios for HTTP with an auto-refresh interceptor, TanStack Query (React Query) for server state, and React Context for auth state. Google Maps is planned via `@react-google-maps/api`.

> **Decision:** Valuation, heatmap, area-intelligence, and report endpoints are **internal-only** — called by this frontend (JWT-gated), not exposed as a public API. No external developer portal or API-key access.

---

## Status Legend

| Marker | Meaning     |
| ------ | ----------- |
| `[ ]`  | Not started |
| `[~]`  | In progress |
| `[x]`  | Done        |
| `[D]`  | Deferred    |

---

## Architecture: What's Built vs Planned

### Infrastructure layer — built

| Component             | File                              | Status | Description                                                                                          |
| --------------------- | --------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| Axios instance        | `src/lib/api.ts`                  | `[x]`  | Base URL from `NEXT_PUBLIC_API_URL`, `withCredentials`                                               |
| Request interceptor   | `src/lib/api.ts`                  | `[x]`  | Attaches `Authorization: Bearer <token>`                                                             |
| 401 auto-refresh      | `src/lib/api.ts`                  | `[x]`  | Catches 401 → calls `/auth/refresh` → retries                                                        |
| Token deduplication   | `src/lib/api.ts`                  | `[x]`  | `refreshPromise` singleton prevents thundering-herd                                                  |
| Token helpers         | `src/lib/auth.ts`                 | `[x]`  | `storeTokens`, `clearTokens`, `isAuthenticated`                                                      |
| QueryProvider         | `src/providers/QueryProvider.tsx` | `[x]`  | `QueryClientProvider` with default options                                                           |
| AuthProvider          | `src/providers/AuthProvider.tsx`  | `[x]`  | React Context for `user`, `isLoading`, `isAuthenticated`, `login`, `signup`, `logout`, `refreshUser` |
| `useAuth` hook        | `src/providers/AuthProvider.tsx`  | `[x]`  | Exported from the same file (not from `hooks/`)                                                      |
| Providers composition | `src/providers/Providers.tsx`     | `[x]`  | `QueryProvider > AuthProvider` nesting                                                               |
| Providers wired       | `src/app/layout.tsx`              | `[ ]`  | **Not wired yet** — layout renders bare `<body>{children}</body>` without `<Providers>`              |

### Pages — none built

| Route          | File               | Status | Description                            |
| -------------- | ------------------ | ------ | -------------------------------------- |
| `/`            | `src/app/page.tsx` | `[ ]`  | Still Nx boilerplate, no GABAI content |
| `/auth/login`  | —                  | `[ ]`  | LoginForm                              |
| `/auth/signup` | —                  | `[ ]`  | SignupForm                             |
| `/map`         | —                  | `[ ]`  | Main map with 3-view toggle            |
| `/admin/*`     | —                  | `[ ]`  | Admin dashboard pages                  |

### Components — none built

The `src/components/` directory does not exist. Planned components:

| Component               | Status | Purpose                                              |
| ----------------------- | ------ | ---------------------------------------------------- |
| `MapContainer`          | `[ ]`  | Google Maps JS API wrapper                           |
| `ViewToggle`            | `[ ]`  | Heatmap / Listings / Valuation mode switcher         |
| `HeatmapLayer`          | `[ ]`  | GeoJSON tile layer on map                            |
| `ListingPin`            | `[ ]`  | Property pin with click handler                      |
| `ValuationPanel`        | `[ ]`  | Slide-in panel with estimate + intel                 |
| `ConfidenceBadge`       | `[ ]`  | Green/yellow/red confidence indicator                |
| `AreaIntelCard`         | `[ ]`  | Bullet point news card with source attribution       |
| `DataCompletenessMeter` | `[ ]`  | 0-100% feature availability bar                      |
| `BirComplianceRow`      | `[ ]`  | BIR floor + audit risk (prototype)                   |
| `DisclaimerBanner`      | `[ ]`  | Legal disclaimer                                     |
| `FilterBar`             | `[ ]`  | Property type, price range, time period              |
| `LoginForm`             | `[ ]`  | Email + password login                               |
| `SignupForm`            | `[ ]`  | Email + password signup                              |
| `ApiKeyCard`            | `[ ]`  | Show/hide key, copy, rotate                          |
| `UpgradeButton`         | `[D]`  | Xendit payment redirect (deferred — no external API) |
| `AdminSidebar`          | `[ ]`  | Admin navigation sidebar                             |

### Hooks — none built

The `src/hooks/` directory exists but is empty. Planned hooks:

| Hook           | Type          | Status | Endpoint                         | Notes                                      |
| -------------- | ------------- | ------ | -------------------------------- | ------------------------------------------ |
| `useValuation` | `useMutation` | `[ ]`  | `POST /valuation`                | JWT-gated (internal-only)                  |
| `useHeatmap`   | `useQuery`    | `[ ]`  | `GET /heatmap/tiles`             | Cached, filtered by type/price             |
| `useAreaIntel` | `useQuery`    | `[ ]`  | `GET /area/intelligence`         | `staleTime: 1hr`, enabled when lat/lng set |
| `useApiKeys`   | —             | `[ ]`  | `GET/POST/DELETE /auth/api-keys` | List, create, rotate, revoke               |

---

## HTTP Client: Axios Setup

The single `api` Axios instance in `src/lib/api.ts` is the HTTP backbone:

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1',
  withCredentials: true, // Sends HttpOnly cookies (refresh token)
  headers: { 'Content-Type': 'application/json' },
});
```

**Key behaviors:**

| Feature            | Implementation                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------- | ----------------------------- |
| Access token       | Module-level variable (`let accessToken: string                                          | null`). **Not localStorage.** |
| Auth header        | Request interceptor attaches `Authorization: Bearer <token>` if token is set             |
| 401 handling       | Response interceptor catches 401 → calls `POST /auth/refresh` → retries original request |
| Deduplication      | `refreshPromise` singleton — concurrent 401s share one refresh call                      |
| Refresh failure    | Clears token, redirects to `/auth/login`                                                 |
| Refresh request    | Uses raw `axios.post` (not the intercepting instance) to avoid loops                     |
| Envelope awareness | Accesses `response.data.data.accessToken` — aware of `{ data, error }` shape             |

---

## Auth Flow in Frontend

### Token Storage

- **Access token:** In-memory only — module-level variable in `api.ts`. Never persisted to `localStorage` (XSS protection per the architectural decision).
- **Refresh token:** HttpOnly cookie (`withCredentials: true` on Axios). Not accessible from JS; auto-sent on all requests to the API.

### Auth State (React Context)

`AuthProvider` (`src/providers/AuthProvider.tsx`) provides:

```typescript
interface AuthState {
  user: User | null; // id, email, role, tier
  isLoading: boolean; // True during initial /auth/me call
  isAuthenticated: boolean; // user !== null
  login: (email, password) => Promise<void>;
  signup: (email, password) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
```

### Flow

```
Mount
  → if isAuthenticated() (access token in memory)
    → GET /auth/me → set user
  → else
    → isLoading = false, user = null

Login
  → POST /auth/login
  → storeTokens({ accessToken }) → setAccessToken(token)
  → setUser(response.data.data.user)

Logout
  → POST /auth/logout (best-effort; catches errors)
  → clearTokens() → setUser(null)

401 interceptor (on any request)
  → POST /auth/refresh (with credentials)
  → setAccessToken(newToken)
  → retry original request
  → on failure: clear tokens, redirect to /auth/login

Refresh token theft detection
  → Handled server-side (revoked-token reuse → all tokens revoked)
  → Client just sees 401 on next request → redirected to login
```

---

## TanStack Query Configuration

**File:** `src/providers/QueryProvider.tsx`

```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1, // Single retry on failure
      refetchOnWindowFocus: false, // No auto-refetch on tab focus
    },
  },
});
```

- `QueryClient` is created via `useState` — stable across re-renders.
- No React Query DevTools installed.
- All queries go through the Axios `api` instance → automatically have auth headers and 401 handling.

---

## Three Map Views (Planned)

All views share a single `MapContainer` component. A top-bar toggle switches modes:

```
[ Heatmap ] [ Listings ] [ Valuation ]
```

### View A — Heatmap

- Full-screen map with per-sqm value heat layer (GeoJSON tiles from `GET /heatmap/tiles`)
- Filter bar: property type, price range, time period
- No listing pins — pure density visualization
- Drop-a-pin calls `GET /heatmap/estimate` for a quick range tooltip

### View B — Listings Only

- Listing pins — no heat layer
- Click a pin: side panel with asking price, property specs, days on market
- User's own submitted listings shown in a distinct color
- No valuation or intelligence shown

### View C — Valuation + Intelligence

- Pin an area or click a listing → `POST /valuation` call
- Panel slides in from the right:
  - **Valuation estimate** with confidence band (green/yellow/red)
  - **Price signal:** "Seller asking PHP X — model estimates PHP Y — [overpriced / fair / underpriced]"
  - **Area intelligence bullets** (registered users only, gated)
  - **Comparables list** with distance and price per sqm
  - **Data completeness** meter (0–100%)
  - **BIR compliance** indicator (prototype, flagged)
  - **Legal disclaimer:** "This is not a professional appraisal. Our model could be wrong."

---

## Actual Directory Structure

```
apps/gabai/web/src/
├── app/
│   ├── layout.tsx                       ← [x] No providers wired yet
│   ├── page.tsx                         ← [x] Nx boilerplate
│   ├── global.css                       ← [x] Tailwind directives
│   └── api/
│       └── hello/route.ts               ← [x] Trivial boilerplate
├── components/                          ← [ ] Directory does not exist
├── hooks/                               ← [ ] Directory exists, empty
├── lib/
│   ├── api.ts                           ← [x] Axios + interceptors
│   └── auth.ts                          ← [x] Token helpers
├── providers/
│   ├── AuthProvider.tsx                 ← [x] Auth context (+ useAuth hook)
│   ├── Providers.tsx                    ← [x] QueryProvider > AuthProvider
│   └── QueryProvider.tsx                ← [x] TanStack Query client
└── public/
    └── favicon.ico
```

---

## Dependencies

From `apps/gabai/web/package.json`:

| Package                          | Status    | Purpose                 |
| -------------------------------- | --------- | ----------------------- |
| `next ~16.1.6`                   | Installed | Framework               |
| `react ^19.0.0`                  | Installed | UI library              |
| `axios ^1.16.1`                  | Installed | HTTP client             |
| `@tanstack/react-query ^5`       | Installed | Server state management |
| `@react-google-maps/api`         | Missing   | Google Maps wrapper     |
| `react-hook-form`                | Missing   | Form handling           |
| `zod`                            | Missing   | Schema validation       |
| `@tanstack/react-query-devtools` | Missing   | Query debugging tools   |

---

## Google Maps Integration (Planned)

```tsx
// Planned: components/MapContainer.tsx
'use client';
import { GoogleMap, useLoadScript } from '@react-google-maps/api';

const LIBRARIES: ('visualization' | 'places')[] = ['visualization'];

export function MapContainer() {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!,
    libraries: LIBRARIES,
  });

  if (!isLoaded) return <LoadingSpinner />;

  return (
    <GoogleMap
      mapContainerClassName="w-full h-full"
      center={{ lat: 10.3157, lng: 123.8854 }} // Cebu City center
      zoom={13}
      options={{
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      }}
    >
      {/* ViewToggle selects which child to render */}
    </GoogleMap>
  );
}
```

Requires `NEXT_PUBLIC_GOOGLE_MAPS_KEY` env var. Not yet in `.env.example`.

---

## Confidence UI (Planned)

The `ConfidenceBadge` component visualizes uncertainty:

```
Green  High (>0.85)       — "Based on X comparables within Ykm"
Yellow Medium (0.70–0.85) — "Limited data in this area"
Red    Low (<0.70)        — "Very limited data — estimate may vary significantly"
```

---

## Admin Dashboard Pages (Planned)

### Discover Page

- Form: Location input + property type dropdown + date range → "Run Discover"
- Results table: URL, site name, sample title, checkbox per row
- Actions: "Queue selected" → `POST /admin/discover/approve`

### Scrape Page

- Queue summary + "Run Scraper" button
- Live progress via polling `GET /admin/scrape/status`
- Records table with flag badges, checkboxes, bulk approve/reject

### Train Page

- Pool summary statistics + "Start Training Run" button
- Progress polling (1–3 min for XGBoost)
- Version table: version ID, MAPE, records, date, status

### Sandbox Page

- Read-only map with sandbox model loaded
- Comparison panel: "Live model vs Sandbox" with diff

### Deploy Page

- Version table with status badges
- Promote button → confirm dialog → hot-swap
- Rollback: re-promote an archived version

---

## Disclaimer & BIR Prototype

Every valuation panel must show:

```
⚠ This is not a professional appraisal. Our model could be wrong.
```

The BIR compliance section (prototype, flagged) shows:

```
BIR floor: PHP 2,450,000 · Audit risk: Low
(Prototype — based on zonal values that may be outdated)
```
