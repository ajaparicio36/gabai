import { Injectable, Logger } from '@nestjs/common';
import { GoogleMapsService } from '../pipeline/services/google-maps.service';
import { BrightDataService } from '../pipeline/services/brightdata.service';
import {
  AimlapiExtractionService,
  type ArticleContent,
} from '../pipeline/services/aimlapi-extraction.service';
import {
  ArticleCacheService,
  type CachedArticleSet,
} from '../pipeline/services/article-cache.service';

interface ArticleSentiment {
  sentiment: 'positive' | 'neutral' | 'negative';
  category: 'infrastructure' | 'commercial' | 'residential' | 'risk';
  horizon_years: number;
}

export interface YieldResult {
  score: number;
  articleCount: number;
  positiveRatio: number;
  infraRatio: number;
}

@Injectable()
export class YieldScoreService {
  private readonly logger = new Logger(YieldScoreService.name);

  constructor(
    private readonly googleMapsService: GoogleMapsService,
    private readonly brightdataService: BrightDataService,
    private readonly aimlapiService: AimlapiExtractionService,
    private readonly articleCacheService: ArticleCacheService,
  ) {}

  async getScore(lat: number, lng: number): Promise<YieldResult> {
    let geoCoding: { addressComponents?: Record<string, string> } | null = null;
    try {
      geoCoding = await this.googleMapsService.reverseGeocode(lat, lng);
    } catch {
      this.logger.warn('reverseGeocode failed in getScore, using fallback');
    }
    const ac =
      (geoCoding?.addressComponents as Record<string, string> | undefined) ??
      {};
    const barangay =
      ac.administrative_area_level_4 ??
      ac.sublocality_level_1 ??
      ac.sublocality ??
      '';
    const city =
      ac.administrative_area_level_2 ??
      ac.locality ??
      ac.administrative_area_level_3 ??
      'Manila';

    const query = `infrastructure OR expressway OR school OR development OR hospital OR mall OR road "${city}" ${
      barangay ? `"${barangay}"` : ''
    } 2023 OR 2024 OR 2025`;

    // Check in-process article cache first (populated by AreaService if it ran
    // first for the same lat/lng within the last 5 minutes).
    const cachedSet: CachedArticleSet | null =
      this.articleCacheService.get(query);

    let articles: { title: string; url: string; domain: string }[] = [];
    let validArticles: ArticleContent[] = [];

    if (cachedSet) {
      articles = cachedSet.articles;
      validArticles = cachedSet.contents;
    } else {
      try {
        const discoverResult = await this.brightdataService.discover({
          query,
          limit: 10,
        });

        if (discoverResult.urls && discoverResult.urls.length > 0) {
          articles = discoverResult.urls.slice(0, 6).map((u: string) => ({
            title: u,
            url: u,
            domain: this.extractDomain(u),
          }));
        }
      } catch {
        return { score: 0.5, articleCount: 0, positiveRatio: 0, infraRatio: 0 };
      }

      if (articles.length === 0) {
        return { score: 0.5, articleCount: 0, positiveRatio: 0, infraRatio: 0 };
      }

      const articleContents = await Promise.allSettled(
        articles.map(async (a) => {
          try {
            const markdown = await this.brightdataService.scrapeAsMarkdown(
              a.url,
            );
            return { url: a.url, title: a.title, markdown: markdown ?? '' };
          } catch {
            return null;
          }
        }),
      );

      validArticles = articleContents
        .filter(
          (r): r is PromiseFulfilledResult<ArticleContent> =>
            r.status === 'fulfilled' &&
            r.value !== null &&
            // Filter out scrapes that returned empty or near-empty content
            r.value.markdown.length >= 200,
        )
        .map((r) => r.value);

      // Populate the cache so AreaService can reuse these results.
      this.articleCacheService.set(query, {
        articles,
        contents: validArticles,
      });
    }

    if (validArticles.length === 0) {
      return {
        score: 0.5,
        articleCount: 0,
        positiveRatio: 0,
        infraRatio: 0,
      };
    }

    const sentiments = await this.classifyArticles(validArticles);

    const total = sentiments.length;
    const positiveCount = sentiments.filter(
      (s) => s.sentiment === 'positive',
    ).length;
    const infraCount = sentiments.filter(
      (s) => s.category === 'infrastructure' || s.category === 'commercial',
    ).length;

    const positiveRatio = total > 0 ? positiveCount / total : 0;
    const infraRatio = total > 0 ? infraCount / total : 0;
    const yieldScore = Math.max(
      0,
      Math.min(1, positiveRatio * 0.6 + infraRatio * 0.4),
    );

    return {
      score: yieldScore,
      articleCount: total,
      positiveRatio,
      infraRatio,
    };
  }

  private async classifyArticles(
    articles: ArticleContent[],
  ): Promise<ArticleSentiment[]> {
    const result = await this.aimlapiService.classifyArticles(articles);
    return result ?? [];
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }
}
