import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '@gabai/platform';

interface DiscoverParams {
  query: string;
  limit?: number;
}

interface ScrapeParams {
  url: string;
  schema: Record<string, string>;
}

interface ScrapeResult {
  results: Record<string, unknown>[];
  error?: string;
}

@Injectable()
export class BrightDataService {
  private readonly baseUrl = 'https://api.brightdata.com';
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.getOrThrow<string>('BRIGHTDATA_API_KEY');
  }

  async discover(params: DiscoverParams): Promise<{ urls: string[] }> {
    const url = `${this.baseUrl}/discover`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: params.query,
        output: 'urls',
        limit: params.limit ?? 30,
      }),
    });

    if (!response.ok) {
      throw new InternalServerErrorException({
        code: ERROR_CODES.PIPELINE.DISCOVER_FAILED,
        message: `BrightData Discover failed: ${response.statusText}`,
      });
    }

    const data = (await response.json()) as { urls?: string[] };
    return { urls: data.urls ?? [] };
  }

  async scrape(params: ScrapeParams): Promise<ScrapeResult> {
    const url = `${this.baseUrl}/scraper`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: params.url,
        schema: params.schema,
        format: 'json',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { results: [], error: errorText };
    }

    const data = (await response.json()) as unknown;
    return { results: Array.isArray(data) ? data : [data] };
  }
}
