import { Injectable } from '@nestjs/common';
import type { ArticleContent } from './aimlapi-extraction.service';

export interface CachedArticleSet {
  articles: { title: string; url: string; domain: string }[];
  contents: ArticleContent[];
}

/**
 * In-memory cache for BrightData discover + scrape results.
 *
 * Both AreaService and YieldScoreService build the same search query for a
 * given lat/lng. Without this cache, a single page-load triggers two full
 * BrightData discover + 6×scrape round-trips (≈ 40-80 s each). With this
 * cache, the second call in the same 5-minute window is instant.
 */
@Injectable()
export class ArticleCacheService {
  private readonly cache = new Map<
    string,
    { data: CachedArticleSet; expiresAt: number }
  >();

  /** How long a cached article set lives (5 minutes). */
  private readonly TTL_MS = 5 * 60 * 1000;

  get(query: string): CachedArticleSet | null {
    const entry = this.cache.get(query);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(query);
      return null;
    }
    return entry.data;
  }

  set(query: string, data: CachedArticleSet): void {
    this.cache.set(query, { data, expiresAt: Date.now() + this.TTL_MS });
  }
}
