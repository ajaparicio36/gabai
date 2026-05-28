import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '@gavai/platform';

interface DiscoverParams {
  query: string;
  limit?: number;
}

interface DiscoverResultItem {
  link?: string;
  title?: string;
}

interface DiscoverTaskResponse {
  status: string;
  task_id?: string;
}

interface ScrapeParams {
  url: string;
  schema: Record<string, string>;
}

interface ScrapeResult {
  results: Record<string, unknown>[];
  error?: string;
}

interface UnlockerResponse {
  status_code: number;
  headers: Record<string, string>;
  body: string;
}

@Injectable()
export class BrightDataService {
  private readonly baseUrl = 'https://api.brightdata.com';
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.getOrThrow<string>('BRIGHTDATA_API_KEY');
  }

  async discover(params: DiscoverParams): Promise<{ urls: string[] }> {
    const postBody = {
      query: params.query,
      num_results: Math.min(params.limit ?? 10, 20),
    };

    const postRes = await fetch(`${this.baseUrl}/discover`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postBody),
    });

    if (!postRes.ok) {
      const body = await postRes.text().catch(() => '(unreadable)');
      throw new InternalServerErrorException({
        code: ERROR_CODES.PIPELINE.DISCOVER_FAILED,
        message: `BrightData Discover failed (${postRes.status}): ${body || postRes.statusText}`,
      });
    }

    const task = (await postRes.json()) as DiscoverTaskResponse;
    if (!task.task_id) {
      throw new InternalServerErrorException({
        code: ERROR_CODES.PIPELINE.DISCOVER_FAILED,
        message: 'BrightData Discover did not return a task_id',
      });
    }

    const urls = await this.pollDiscoverResults(task.task_id);
    return { urls };
  }

  private async pollDiscoverResults(taskId: string): Promise<string[]> {
    const pollUrl = `${this.baseUrl}/discover?task_id=${taskId}`;
    const maxAttempts = 30;
    const delayMs = 2000;

    for (let i = 0; i < maxAttempts; i++) {
      const res = await fetch(pollUrl, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });

      if (res.status === 404) {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '(unreadable)');
        throw new InternalServerErrorException({
          code: ERROR_CODES.PIPELINE.DISCOVER_FAILED,
          message: `BrightData Discover poll failed (${res.status}): ${body || res.statusText}`,
        });
      }

      const data = (await res.json()) as {
        status?: string;
        results?: DiscoverResultItem[];
      };

      if (data.status === 'done' && Array.isArray(data.results)) {
        return data.results
          .map((item: DiscoverResultItem) => item.link ?? '')
          .filter(Boolean);
      }

      if (data.status === 'error') {
        throw new InternalServerErrorException({
          code: ERROR_CODES.PIPELINE.DISCOVER_FAILED,
          message: 'BrightData Discover task failed',
        });
      }

      await new Promise((r) => setTimeout(r, delayMs));
    }

    throw new InternalServerErrorException({
      code: ERROR_CODES.PIPELINE.DISCOVER_FAILED,
      message: 'BrightData Discover timed out',
    });
  }

  async scrapeAsMarkdown(url: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/request`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          zone: 'web_unlocker1',
          url,
          format: 'raw',
          data_format: 'markdown',
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        return null;
      }

      const text = await response.text();
      return text.slice(0, 8000);
    } catch {
      return null;
    }
  }

  async scrape(params: ScrapeParams): Promise<ScrapeResult> {
    try {
      const response = await fetch(`${this.baseUrl}/request`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          zone: 'web_unlocker1',
          url: params.url,
          format: 'json',
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { results: [], error: errorText };
      }

      const data = (await response.json()) as UnlockerResponse;
      const parsed = this.parseListingHtml(data.body ?? '', params.url);
      return { results: parsed ? [parsed] : [] };
    } catch (err) {
      return { results: [], error: String(err) };
    }
  }

  private parseListingHtml(
    html: string,
    sourceUrl: string,
  ): Record<string, unknown> | null {
    const strip = (s: string): string =>
      s
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    const title = titleMatch ? strip(titleMatch[1]) : '';

    const pricePatterns = [
      /₱\s*([\d,]+(?:\.\d{2})?)/,
      /PHP\s*([\d,]+(?:\.\d{2})?)/i,
      /(?:price|asking|for sale|₱)\s*[:\s]*([\d,]+)/i,
    ];
    let askingPricePhp: number | null = null;
    for (const p of pricePatterns) {
      const m = html.match(p);
      if (m) {
        const num = Number(m[1].replace(/,/g, ''));
        if (num > 1000) {
          askingPricePhp = num;
          break;
        }
      }
    }

    const areaPatterns = [
      /([\d,]+(?:\.\d+)?)\s*(?:sqm|m²|sq\.?\s*m\.?|square\s*meters)/i,
      /(?:lot|floor|area|size)\s*[:\s]*([\d,]+(?:\.\d+)?)/i,
    ];
    let lotAreaSqm: number | null = null;
    let floorAreaSqm: number | null = null;
    for (const p of areaPatterns) {
      const m = html.match(p);
      if (m) {
        const num = Number(m[1].replace(/,/g, ''));
        if (num > 0 && num < 100000) {
          if (lotAreaSqm == null) lotAreaSqm = num;
          else floorAreaSqm = num;
        }
      }
    }

    const bedroomsMatch = html.match(/(\d+)\s*(?:bed(?:room)?s?|br)/i);
    const bedrooms = bedroomsMatch ? Number(bedroomsMatch[1]) : null;

    const bathroomsMatch = html.match(/(\d+)\s*(?:bath(?:room)?s?|ba|wc)/i);
    const bathrooms = bathroomsMatch ? Number(bathroomsMatch[1]) : null;

    const phCities = [
      'manila',
      'quezon city',
      'makati',
      'taguig',
      'pasig',
      'mandaluyong',
      'cebu',
      'mandaue',
      'lapu-lapu',
      'davao',
      'baguio',
      'angeles',
      'bacolod',
      'iligan',
      'iloilo',
      'butuan',
      'cagayan de oro',
      'tacloban',
      'zamboanga',
      'general santos',
      'tagaytay',
      'lucena',
      'san fernando',
      'dagupan',
      'batangas',
      'naga',
      'legazpi',
      'roxas',
      'surigao',
      'ozamiz',
      'dipolog',
      'pagadian',
      'cabadbaran',
      'ligao',
      'tabaco',
      'masbate',
      'calbayog',
      'ormoc',
      'naval',
    ];
    let city: string | null = null;
    const htmlLower = html.toLowerCase();
    for (const c of phCities) {
      if (htmlLower.includes(c)) {
        city = c;
        break;
      }
    }

    const barangayMatch = html.match(
      /(?:barangay|brgy\.?|brgy)\s+([A-Za-z\s]+?)(?:,|\s|$)/i,
    );
    const barangay = barangayMatch ? barangayMatch[1].trim() : null;

    return {
      title,
      asking_price_php: askingPricePhp,
      lot_area_sqm: lotAreaSqm,
      floor_area_sqm: floorAreaSqm,
      bedrooms,
      bathrooms,
      property_type: 'unknown',
      address_raw: `${barangay ? barangay + ', ' : ''}${city ?? ''}`.trim(),
      barangay,
      city,
      developer: null,
      listing_date: new Date().toISOString().split('T')[0],
      source_url: sourceUrl,
    };
  }
}
