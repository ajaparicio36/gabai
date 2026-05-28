import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ERROR_CODES } from '@gabai/platform';
import { roundToGrid } from '@gabai/pipeline';
import { AreaRepository } from './area.repository';
import { GeminiService } from './gemini.service';
import { BrightDataService } from '../pipeline/services/brightdata.service';
import { GoogleMapsService } from '../pipeline/services/google-maps.service';

export interface AreaIntelligenceResult {
  areaName: string;
  bulletPoints: string[];
  sources: { title: string; url: string; domain: string }[];
  lastUpdated: Date;
  stale: boolean;
}

@Injectable()
export class AreaService {
  private readonly DEFAULT_RADIUS_M = 1500;
  private readonly TTL_HOURS = 24;

  constructor(
    private readonly areaRepository: AreaRepository,
    private readonly geminiService: GeminiService,
    private readonly brightdataService: BrightDataService,
    private readonly googleMapsService: GoogleMapsService,
  ) {}

  async getIntelligence(
    lat: number,
    lng: number,
    radiusM: number = this.DEFAULT_RADIUS_M,
  ): Promise<AreaIntelligenceResult> {
    const latKey = roundToGrid(lat);
    const lngKey = roundToGrid(lng);

    const cached = await this.areaRepository.findCached(
      latKey,
      lngKey,
      radiusM,
    );
    if (cached) {
      const sources =
        (cached.sourceArticles as { title: string; url: string }[]) ?? [];
      return {
        areaName: this.formatAreaName(lat, lng),
        bulletPoints: cached.bulletPoints as string[],
        sources: sources.map((s) => ({
          title: s.title,
          url: s.url,
          domain: this.extractDomain(s.url),
        })),
        lastUpdated: cached.fetchedAt,
        stale: false,
      };
    }

    try {
      const result = await this.fetchFresh(lat, lng, latKey, lngKey, radiusM);
      return result;
    } catch {
      const expired = await this.areaRepository.findExpired(
        latKey,
        lngKey,
        radiusM,
      );
      if (expired) {
        const sources =
          (expired.sourceArticles as { title: string; url: string }[]) ?? [];
        return {
          areaName: this.formatAreaName(lat, lng),
          bulletPoints: expired.bulletPoints as string[],
          sources: sources.map((s) => ({
            title: s.title,
            url: s.url,
            domain: this.extractDomain(s.url),
          })),
          lastUpdated: expired.fetchedAt,
          stale: true,
        };
      }

      throw new InternalServerErrorException({
        code: ERROR_CODES.AREA.FETCH_FAILED,
        message:
          'Failed to fetch area intelligence and no cached data available',
      });
    }
  }

  private async fetchFresh(
    lat: number,
    lng: number,
    latKey: number,
    lngKey: number,
    radiusM: number,
  ): Promise<AreaIntelligenceResult> {
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
      'Cebu City';

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
      // If discover fails, proceed with empty articles
    }

    let bulletPoints: string[] = [];
    if (articles.length > 0) {
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

      const validArticles = articleContents
        .filter(
          (
            r,
          ): r is PromiseFulfilledResult<{
            url: string;
            title: string;
            markdown: string;
          }> => r.status === 'fulfilled' && r.value !== null,
        )
        .map((r) => r.value);

      if (validArticles.length > 0) {
        try {
          bulletPoints =
            await this.geminiService.summarizeArticles(validArticles);
        } catch {
          // Return raw article titles if summarization fails
          bulletPoints = validArticles.map((a, i) => `[${i + 1}] ${a.title}`);
        }
      }
    }

    const sourceArticles = articles.map((a) => ({
      title: a.title,
      url: a.url,
    }));

    const expiresAt = new Date(Date.now() + this.TTL_HOURS * 60 * 60 * 1000);

    await this.areaRepository.upsertCache(
      latKey,
      lngKey,
      radiusM,
      bulletPoints,
      sourceArticles,
      expiresAt,
    );

    return {
      areaName: this.formatAreaName(lat, lng),
      bulletPoints,
      sources: articles,
      lastUpdated: new Date(),
      stale: false,
    };
  }

  private formatAreaName(lat: number, lng: number): string {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}${latDir}, ${Math.abs(lng).toFixed(4)}${lngDir}`;
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }
}
