import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleMapsService } from '../pipeline/services/google-maps.service';
import { BrightDataService } from '../pipeline/services/brightdata.service';

interface ArticleContent {
  url: string;
  title: string;
  markdown: string;
}

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
  private readonly apiKey: string;

  constructor(
    private readonly googleMapsService: GoogleMapsService,
    private readonly brightdataService: BrightDataService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.getOrThrow<string>('GEMINI_API_KEY');
  }

  async getScore(lat: number, lng: number): Promise<YieldResult> {
    const geoCoding = await this.googleMapsService.reverseGeocode(lat, lng);
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

    let articles: { title: string; url: string; domain: string }[] = [];

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
          const markdown = await this.brightdataService.scrapeAsMarkdown(a.url);
          return { url: a.url, title: a.title, markdown: markdown ?? '' };
        } catch {
          return null;
        }
      }),
    );

    const validArticles = articleContents
      .filter(
        (r): r is PromiseFulfilledResult<ArticleContent> =>
          r.status === 'fulfilled' && r.value !== null,
      )
      .map((r) => r.value);

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
    const articleTexts = articles
      .map(
        (a, i) =>
          `Article ${i + 1}: "${a.title}"\nSource: ${a.url}\nContent:\n${a.markdown.slice(0, 3000)}`,
      )
      .join('\n\n---\n\n');

    const prompt = `You are a real estate market analyst. Based on the following news articles about infrastructure and development, classify each article.

RULES:
- For each article, output a JSON object with:
  - "sentiment": one of "positive", "neutral", or "negative" (for property value impact)
  - "category": one of "infrastructure", "commercial", "residential", or "risk"
  - "horizon_years": estimated years until the development materializes (number)
- Output ONLY a valid JSON array, nothing else
- One object per article in the same order

ARTICLES:
${articleTexts}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 2048,
            },
          }),
          signal: AbortSignal.timeout(15000),
        },
      );

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };

      const text =
        data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed: ArticleSentiment[] = JSON.parse(jsonMatch[0]);
      return parsed;
    } catch {
      return [];
    }
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }
}
