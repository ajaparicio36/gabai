# 08 — Area Intelligence

## Overview

When a user drops a pin on the map (Valuation view), the system fetches news about infrastructure, developments, and risks in that area. Results are cached by a 500m grid cell key to prevent redundant API calls for nearby pins.

This endpoint is gated behind **registered user authentication** (JWT) to drive signups.

---

## Cache Key Design

Round coordinates to a 500m grid cell so nearby pins share the same cache entry:

```typescript
// libs/pipeline/src/intelligence/area-key.ts
export function areaKey(lat: number, lng: number, radiusM = 1500) {
  // 0.005 degrees ≈ 500m at Philippine latitudes (~10°N)
  const latKey = Math.round(lat / 0.005) * 0.005;
  const lngKey = Math.round(lng / 0.005) * 0.005;
  return { latKey, lngKey, radiusM };
}
```

---

## Cache Lookup Flow

```typescript
// apps/gavai/nest/src/modules/area/area-intelligence.service.ts
@Injectable()
export class AreaIntelligenceService {
  async getIntelligence(
    lat: number,
    lng: number,
  ): Promise<AreaIntelligenceDto> {
    const key = areaKey(lat, lng);

    // 1. Check DB cache
    const cached = await this.prisma.areaIntelligence.findUnique({
      where: { latKey_lngKey_radiusM: key },
    });

    if (cached && cached.expiresAt > new Date()) {
      return this.toDto(cached); // Cache hit
    }

    // 2. Cache miss or expired — fetch fresh
    const articles = await this.fetchAreaNews(lat, lng, key.radiusM);
    const bulletPoints = await this.summariseWithGemini(articles);

    // 3. Upsert with 24h TTL
    const fresh = await this.prisma.areaIntelligence.upsert({
      where: { latKey_lngKey_radiusM: key },
      create: {
        ...key,
        bulletPoints,
        sourceArticles: articles as any,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      update: {
        bulletPoints,
        sourceArticles: articles as any,
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return this.toDto(fresh);
  }
}
```

---

## BrightData Discover — Area News

Uses BrightData Discover API to find recent news articles relevant to the area:

```typescript
async fetchAreaNews(lat: number, lng: number, radiusM: number): Promise<Article[]> {
  const location = await this.reverseGeocode(lat, lng);
  const query = `infrastructure OR expressway OR school OR development "${location.city}" "${location.barangay}" 2024 OR 2025`;

  const discoverRes = await this.brightdata.discover({ query, output: 'urls', limit: 10 });

  const articles: Article[] = [];
  for (const url of discoverRes.urls.slice(0, 6)) {
    const scraped = await this.brightdata.scrapeAsMarkdown(url);
    articles.push({ url: scraped.url, content: scraped.markdown, title: scraped.title });
  }
  return articles;
}
```

---

## Gemini Flash Summarization

**Critical constraint: summarize only — no synthesis, no hallucination.**

```typescript
async summariseWithGemini(articles: Article[]): Promise<string[]> {
  const combined = articles
    .map((a, i) => `## Article ${i + 1}: ${a.title}\nSource: ${a.url}\n${a.content}`)
    .join('\n\n---\n\n');

  const response = await this.gemini.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{
      role: 'user',
      parts: [{
        text: `You are a Philippine real estate analyst assistant. Summarize the following news articles into 4–6 bullet points about infrastructure, developments, or risks relevant to property values in this area.

RULES:
- ONLY use information explicitly stated in the articles.
- DO NOT add any information, speculation, or context not present in the source text.
- For each bullet, include the article number as a source reference in brackets: [1], [2], etc.
- Be specific about project names and timelines where the articles mention them.
- Do not include introductory or concluding text. Return bullet points only.
- Use "- " prefix for each bullet.

Articles:
${combined}`
      }],
    }],
  });

  const text = response.response.text();
  return text
    .split('\n')
    .filter(l => l.trim().startsWith('-'))
    .map(l => l.replace(/^-\s*/, '').trim())
    .filter(Boolean);
}
```

---

## Modes of Failure

| Scenario                                | Behavior                                                     |
| --------------------------------------- | ------------------------------------------------------------ |
| All 6 articles fail to scrape           | Return empty array, don't cache                              |
| Gemini API timeout (5s)                 | Return articles raw (titles + URLs), no bullets              |
| Gemini returns fewer than 3 bullets     | Return what it gave + "Insufficient information in articles" |
| BrightData Discover returns 0 results   | Return empty, cache miss → no cached entry                   |
| Stale cache (expired) + BrightData down | Return expired cache with `stale: true` flag                 |
| User not registered (no JWT)            | Return 401 — gate area intelligence behind registered users  |

---

## User-Facing Output

```
📰 Area Intelligence — Cebu IT Park, Lahug, Cebu City

• New Cebu BRT Phase 2 approved, expected to connect IT Park to SRP by Q3 2026 [1]
• Two new high-rise condo projects announced by Filinvest along Salinas Drive [2]
• Cebu City LGU approved revised zoning allowing mixed-use in IT Park zone [3]
• PAGASA flood mitigation project in Lahug watershed starting next quarter [4]
• Ayala Malls Central Bloc expansion to add 15,000 sqm retail by 2027 [1]

Last updated: 2 hours ago
Sources: SunStar Cebu, CDN Digital, Philippine Daily Inquirer
```

---

## Cache TTL

- **Default:** 24 hours
- **Stale tolerance:** Return expired cache if BrightData/Gemini is unavailable (adds `stale: true` to response)
- **Manual bust:** No UI for hackathon. DB-level: `DELETE FROM "AreaIntelligence" WHERE ...`
- **Future:** Configurable per area activity level. File GitHub issue.

---

## Cost Estimate

| Service                         | Usage               | Cost            |
| ------------------------------- | ------------------- | --------------- |
| BrightData Discover (area news) | ~200 queries        | ~$2 from credit |
| Gemini 2.0 Flash                | ~200 summarizations | ~$0.40          |
| **Total**                       |                     | **~$2.40**      |

With 500m grid caching, the effective cost per unique 500m × 500m area is $2.40 / area for the first user. Subsequent users within the same grid cell hit the cache and cost $0.
