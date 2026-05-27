# 07 — Frontend

## Overview

Next.js 14 (App Router) with Tailwind CSS. Three map views share a single Google Maps JS API instance. The admin dashboard manages the full model lifecycle through a UI.

---

## Three Map Views

All views use the same `MapContainer` component. A top-bar toggle switches modes:

```
[ Heatmap ] [ Listings ] [ Valuation ]
```

### View A — Heatmap

- Full-screen map with a per-sqm value heat layer (GeoJSON tiles from `GET /heatmap/tiles`)
- Filter bar: property type, price range, time period
- No listing pins — pure density visualization
- Drop-a-pin calls `GET /heatmap/estimate` for a quick range tooltip

### View B — Listings Only

- Listing pins — no heat layer
- Click a pin: side panel with asking price, property specs, days on market
- User's own submitted listings shown in a distinct color
- No valuation or intelligence shown (clean, focused experience)

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

## Component Tree

```
apps/gabai/web/src/
├── components/
│   ├── MapContainer.tsx            ← Google Maps JS API wrapper
│   ├── ViewToggle.tsx              ← Heatmap / Listings / Valuation switcher
│   ├── HeatmapLayer.tsx            ← renders GeoJSON tiles on the map
│   ├── ListingPin.tsx              ← individual property pin with click handler
│   ├── ValuationPanel.tsx          ← slide-in panel with estimate + intel
│   ├── ConfidenceBadge.tsx         ← visual confidence indicator (green/yellow/red)
│   ├── AreaIntelCard.tsx           ← bullet point news card with source attribution
│   ├── DataCompletenessMeter.tsx   ← 0-100% bar showing feature availability
│   ├── BirComplianceRow.tsx        ← "BIR floor: PHP X · Audit risk: Low/Medium/High" (prototype)
│   ├── DisclaimerBanner.tsx        ← "This is not a professional appraisal..."
│   ├── FilterBar.tsx               ← property type, price range, time period filters
│   ├── LoginForm.tsx               ← email + password login
│   ├── SignupForm.tsx              ← email + password signup
│   ├── ApiKeyCard.tsx              ← show/hide key, copy button, rotate button
│   ├── UpgradeButton.tsx           ← "Upgrade to Pro" → Xendit payment
│   └── AdminSidebar.tsx            ← discover / scrape / train / deploy nav
├── hooks/
│   ├── useValuation.ts             ← TanStack Query wrapper for POST /valuation
│   ├── useHeatmap.ts               ← TanStack Query for GET /heatmap/tiles
│   ├── useAreaIntel.ts             ← TanStack Query for GET /area/intelligence
│   ├── useAuth.ts                  ← login, signup, refresh, logout, me
│   └── useApiKeys.ts              ← list, create, rotate, revoke
├── lib/
│   ├── api.ts                      ← axios/fetch instance with interceptors (auto-refresh)
│   └── auth.ts                     ← token storage, refresh logic
└── providers/
    └── AuthProvider.tsx             ← React context for auth state
```

---

## Route Map

```
apps/gabai/web/src/app/
├── layout.tsx                       ← global layout + AuthProvider
├── page.tsx                         ← landing page (redirect unauthenticated → login)
├── auth/
│   ├── login/page.tsx               ← LoginForm
│   └── signup/page.tsx              ← SignupForm
├── map/
│   └── page.tsx                     ← main map with ViewToggle + panel
├── dashboard/
│   └── page.tsx                     ← user dashboard: API keys, tier, upgrade
└── admin/
    ├── layout.tsx                   ← admin JWT guard + AdminSidebar
    ├── discover/page.tsx            ← query form + URL review table
    ├── scrape/page.tsx              ← pending queue + run button + review table
    ├── train/
    │   ├── page.tsx                 ← training pool summary + trigger + version table
    │   └── sandbox/page.tsx         ← read-only map with sandbox model
    └── deploy/page.tsx              ← version table + Promote + rollback actions
```

---

## Auth Flow in Frontend

### Token Storage

- Access token: in-memory (React state / context). Not persisted to localStorage (XSS protection).
- Refresh token: HttpOnly cookie (set by NestJS) or in-memory. If cookie: not accessible from JS, auto-sent on requests.

### Auto-Refresh Interceptor

```typescript
// apps/gabai/web/src/lib/api.ts
let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;

      // Deduplicate concurrent refresh calls
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;
      accessToken = newToken;
      error.config.headers.Authorization = `Bearer ${newToken}`;
      return api(error.config);
    }
    return Promise.reject(error);
  },
);
```

### JWT Guard on Admin Pages

The `admin/layout.tsx` checks for `role === 'admin'` on mount. If not admin, redirects to `/map`.

```typescript
// apps/gabai/web/src/app/admin/layout.tsx
'use client';
import { useAuth } from '@/hooks/useAuth';
import { redirect } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!user || user.role !== 'admin') redirect('/map');

  return (
    <div className="flex">
      <AdminSidebar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

---

## Confidence UI

The `ConfidenceBadge` component visualizes uncertainty:

```
🟢 High confidence (>0.85)  — "Based on X comparables within Ykm"
🟡 Medium confidence (0.70–0.85) — "Limited data in this area"
🔴 Low confidence (<0.70) — "Very limited data — estimate may vary significantly"
```

The `ValuationPanel` shows the confidence band as a range bar:

```
┌────────────────────────────────────────┐
│  Estimated value: PHP 3,200,000        │
│  Range: PHP 2,720,000 – PHP 3,680,000  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░   │
│  ↑ Model estimate                      │
│  Based on 7 comparables within 2km     │
│  Data completeness: 85%                │
│                                        │
│  ⚠ This is not a professional          │
│  appraisal. Our model could be wrong.  │
└────────────────────────────────────────┘
```

---

## Admin Dashboard Pages

### Discover Page

- **Form:** Location input + property type dropdown + date range (optional) → "Run Discover" button
- **Results table:** URL, site name, sample title, checkbox per row
- **Actions:** "Queue selected" → sends `POST /admin/discover/approve`
- **Loading state:** Progress indicator while BrightData Discover runs (can take 30–60s)

### Scrape Page

- **Queue summary:** "15 URLs queued, 3 scraping, 42 done"
- **"Run Scraper" button:** dispatches all queued to BullMQ
- **Live progress:** polls `GET /admin/scrape/status` every 5s
- **Records table:** title, price, area, city, flagged badge, checkbox
- **Actions:** "Approve selected" / "Reject selected" (bulk + individual)
- **Inline edit:** click a cell to correct a flagged value before approving

### Train Page

- **Pool summary:** "247 approved records · 134 Cebu City · 78 residential_lot · 56 house_and_lot"
- **"Start Training Run" button:** triggers sidecar retraining
- **Progress:** polls until complete (1–3 min for 200 records on XGBoost)
- **Version table:** version ID, MAPE, records, date, status (training / ready / deployed / archived)
- **"Preview on sandbox" link** per version → opens sandbox map

### Sandbox Page

- Read-only map with sandbox model loaded
- Drop pins to test valuations with the new model before deploying
- Comparison panel: "Live model: PHP 3.2M · Sandbox: PHP 3.5M · Diff: +9%"

### Deploy Page

- **Version table:** all versions with status badges
- **"Promote" button** on ready/archived versions → confirm dialog → hot-swap → status updated
- **Rollback:** re-promote an archived version → instant reversion
- Currently deployed version highlighted

---

## State Management

TanStack Query (React Query) for server state. React Context for auth state (current user, tokens). No Redux or Zustand needed for the current scope.

```typescript
// hooks/useValuation.ts
export function useValuation() {
  return useMutation({
    mutationFn: (input: ValuationInput) =>
      api.post('/valuation', input, {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
  });
}

// hooks/useAreaIntel.ts
export function useAreaIntel(lat: number, lng: number) {
  return useQuery({
    queryKey: ['areaIntel', lat, lng],
    queryFn: () => api.get(`/area/intelligence?lat=${lat}&lng=${lng}`),
    enabled: !!lat && !!lng,
    staleTime: 1000 * 60 * 60, // 1 hour (server has 24h cache, but check more often)
  });
}
```

---

## Google Maps Integration

```tsx
// components/MapContainer.tsx
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
      {view === 'heatmap' && <HeatmapLayer />}
      {view === 'listings' && <ListingPins />}
      {view === 'valuation' && <ValuationOverlay />}
    </GoogleMap>
  );
}
```

---

## Disclaimer & BIR Prototype

Every valuation panel must show:

```
⚠ This is not a professional appraisal. Our model could be wrong.
```

The BIR compliance section (prototype, flagged as such) shows:

```
BIR floor: PHP 2,450,000 · Audit risk: Low
(Prototype — based on zonal values that may be outdated)
```
